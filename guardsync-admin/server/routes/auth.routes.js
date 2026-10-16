import express from 'express';
import db, { siteRowToObj } from '../db.js';
import { signToken, comparePassword } from '../auth.js';
import { validate } from '../validation/index.js';
import { loginSchema, faceLoginSchema } from '../validation/auth.schemas.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { decrypt } from '../encryption.js';
import { facesMatch } from '../utils/face.js';
import { success, unauthorized, forbidden, badRequest, serverError } from '../utils/responses.js';

const router = express.Router();

// Helper to transform guard row with business logic (decryption, masking, parsing).
// `viewer` is the logged-in user ({ id, role }). What comes back depends on who is asking:
//   admin        - full ID and bank details (needed to edit them)
//   the guard    - their own record, with ID and bank numbers masked
//   anyone else  - masked ID, no bank details
// With no viewer the most restricted view is returned.
// The face template never leaves the server, not even to its own guard: anyone holding it could
// replay it to pass the face check. Clients only learn whether a face is enrolled.
const guardRowToObj = (row, viewer = null) => {
  const isAdmin = viewer?.role === 'admin';
  const isSelf = viewer?.role === 'guard' && viewer.id === row.id;
  // Decrypt PII fields (these are encrypted at rest in the database)
  const decryptedAadhar = decrypt(row.aadharNumber);
  const decryptedPan = decrypt(row.panNumber);
  const decryptedBankAccount = decrypt(row.bankAccountNumber);
  const decryptedBankIfsc = decrypt(row.bankIfsc);
  const decryptedBankName = decrypt(row.bankName);
  const decryptedAccountHolder = decrypt(row.accountHolderName);
  const decryptedAddress = decrypt(row.address);
  const decryptedEmergencyContact = decrypt(row.emergencyContact);
  
  // Remove sensitive fields from the row
  const { password, faceDescriptor, ...rowWithoutPassword } = row;
  
  return {
    ...rowWithoutPassword,
    // Transform location from lat/lng to object
    location: (row.lat !== null && row.lng !== null) ? { lat: Number(row.lat), lng: Number(row.lng) } : undefined,
    // Parse JSON field
    locationHistory: row.locationHistory ? JSON.parse(row.locationHistory) : [],
    // Convert integer to boolean
    clockedIn: !!row.clockedIn,
    // Apply decrypted values (with masking for sensitive data)
    address: decryptedAddress || null,
    emergencyContact: decryptedEmergencyContact || null,
    // Aadhar is protected under India's Aadhaar Act - mask for security
    aadharNumber: decryptedAadhar ? `XXXX-XXXX-${decryptedAadhar.slice(-4)}` : null,
    aadharNumberFull: isAdmin ? decryptedAadhar || null : null,
    panNumber: decryptedPan ? (isAdmin || isSelf ? decryptedPan : `XXXXXX${decryptedPan.slice(-4)}`) : null,
    // Create nested document object
    documents: {
      photographUrl: row.photographUrl || null,
      aadharDocUrl: row.aadharDocUrl || null,
      panDocUrl: row.panDocUrl || null,
      relievingLetterUrl: row.relievingLetterUrl || null,
    },
    // Bank details (decrypted with account masking)
    bankDetails: decryptedBankAccount && (isAdmin || isSelf) ? {
      accountNumber: `XXXXXX${decryptedBankAccount.slice(-4)}`,
      ifsc: decryptedBankIfsc,
      bankName: decryptedBankName,
      accountHolderName: decryptedAccountHolder,
    } : null,
    bankAccountNumber: isAdmin ? decryptedBankAccount || null : null,
    bankIfsc: isAdmin || isSelf ? decryptedBankIfsc || null : null,
    bankName: isAdmin || isSelf ? decryptedBankName || null : null,
    accountHolderName: isAdmin || isSelf ? decryptedAccountHolder || null : null,
    faceEnrolled: !!faceDescriptor,
  };
};

// POST /api/auth/login - Guard login with email/password
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const guard = db.prepare('SELECT * FROM guards WHERE email = ?').get(email);
    if (!guard) {
      return unauthorized(res, 'Invalid email or password');
    }
    const ok = await comparePassword(password, guard.password, async (newHash) => {
      db.prepare('UPDATE guards SET password = ? WHERE id = ?').run(newHash, guard.id);
    });
    if (!ok) {
      return unauthorized(res, 'Invalid email or password');
    }
    // Anyone can submit an enrolment. It is not an account until an admin approves it.
    if (guard.status === 'pending') {
      return forbidden(res, 'Your enrolment is waiting for approval. You can log in once an admin approves it.');
    }

    let site = null;
    if (guard.siteId) {
      const siteRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(guard.siteId);
      if (siteRow) site = siteRowToObj(siteRow);
    }

    const token = signToken({ id: guard.id, role: 'guard' });

    return success(res, { token, role: 'guard', guard: guardRowToObj(guard, { id: guard.id, role: 'guard' }), site });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/auth/face-login - Login with a face.
// The app sends the guard id and the face template it just captured. The comparison with the
// enrolled template happens here on the server, so a guard id on its own cannot log anyone in.
router.post('/face-login', authLimiter, validate(faceLoginSchema), (req, res) => {
  const guardId = req.body.guardId ?? req.body.guard_id;
  try {
    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(guardId);
    // One generic answer for every failure, so the route cannot be used to probe for guard ids
    if (!guard || guard.status === 'pending' || !facesMatch(req.body.descriptor, guard.faceDescriptor)) {
      return unauthorized(res, 'Face not recognised');
    }

    let site = null;
    if (guard.siteId) {
      const siteRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(guard.siteId);
      if (siteRow) site = siteRowToObj(siteRow);
    }

    const token = signToken({ id: guard.id, role: 'guard' });

    return success(res, { token, role: 'guard', guard: guardRowToObj(guard, { id: guard.id, role: 'guard' }), site });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// Export the helper for use in other route files
export { guardRowToObj };
export default router;
