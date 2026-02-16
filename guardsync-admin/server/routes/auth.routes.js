import express from 'express';
import db, { siteRowToObj } from '../db.js';
import { signToken, comparePassword } from '../auth.js';
import { validate } from '../validation/index.js';
import { loginSchema, faceLoginSchema } from '../validation/auth.schemas.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { decrypt } from '../encryption.js';
import { success, unauthorized, badRequest, serverError } from '../utils/responses.js';

const router = express.Router();

// Helper to transform guard row with business logic (decryption, masking, parsing)
const guardRowToObj = (row) => {
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
  const { password, ...rowWithoutPassword } = row;
  
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
    aadharNumberFull: decryptedAadhar || null,
    panNumber: decryptedPan || null,
    // Create nested document object
    documents: {
      photographUrl: row.photographUrl || null,
      aadharDocUrl: row.aadharDocUrl || null,
      panDocUrl: row.panDocUrl || null,
      relievingLetterUrl: row.relievingLetterUrl || null,
    },
    // Bank details (decrypted with account masking)
    bankDetails: decryptedBankAccount ? {
      accountNumber: `XXXXXX${decryptedBankAccount.slice(-4)}`,
      ifsc: decryptedBankIfsc,
      bankName: decryptedBankName,
      accountHolderName: decryptedAccountHolder,
    } : null,
    bankAccountNumber: decryptedBankAccount || null,
    bankIfsc: decryptedBankIfsc || null,
    bankName: decryptedBankName || null,
    accountHolderName: decryptedAccountHolder || null,
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

    let site = null;
    if (guard.siteId) {
      const siteRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(guard.siteId);
      if (siteRow) site = siteRowToObj(siteRow);
    }

    const token = signToken({ id: guard.id, role: 'guard' });

    return success(res, { token, role: 'guard', guard: guardRowToObj(guard), site });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// GET /api/auth/face-descriptors - Get all guards with face descriptors for facial recognition login
router.get('/face-descriptors', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, faceDescriptor FROM guards WHERE faceDescriptor IS NOT NULL').all();
    return success(res, rows.map(row => ({
      id: row.id,
      name: row.name,
      descriptor: row.faceDescriptor,
    })));
  } catch (err) {
    return serverError(res, String(err));
  }
});

// POST /api/auth/face-login - Login with face descriptor (guard ID from face match)
router.post('/face-login', authLimiter, validate(faceLoginSchema), (req, res) => {
  const { guardId } = req.body;
  try {
    const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(guardId);
    if (!guard) return unauthorized(res, 'Guard not found');

    let site = null;
    if (guard.siteId) {
      const siteRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(guard.siteId);
      if (siteRow) site = siteRowToObj(siteRow);
    }

    const token = signToken({ id: guard.id, role: 'guard' });

    return success(res, { token, role: 'guard', guard: guardRowToObj(guard), site });
  } catch (err) {
    return serverError(res, String(err));
  }
});

// Export the helper for use in other route files
export { guardRowToObj };
export default router;
