/**
 * ONE-TIME MIGRATION SCRIPT
 * 
 * This script encrypts all existing PII (Personally Identifiable Information)
 * in the guards table. It's idempotent - safe to run multiple times.
 * 
 * PII fields encrypted:
 * - aadharNumber (protected under India's Aadhaar Act)
 * - panNumber
 * - bankAccountNumber
 * - bankIfsc
 * - bankName
 * - accountHolderName
 * - address
 * - emergencyContact
 * 
 * Fields NOT encrypted (required for lookups):
 * - phone (used for guard login)
 * - email (used for guard login)
 * - name (used for display)
 * - employeeId (used for display)
 * 
 * Usage:
 *   node server/migrate-encrypt-pii.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt, isEncrypted } from './encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'gw.db');

console.log('🔐 Starting PII encryption migration...\n');
console.log(`Database: ${DB_PATH}`);
console.log(`Encryption Key: ${process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Not set (using dev key)'}\n`);

// Open database
const db = new Database(DB_PATH);

// Get all guards
const guards = db.prepare('SELECT * FROM guards').all();

console.log(`Found ${guards.length} guards to process\n`);

let encryptedCount = 0;
let skippedCount = 0;
let errorCount = 0;

// PII fields to encrypt
const piiFields = [
  'aadharNumber',
  'panNumber',
  'bankAccountNumber',
  'bankIfsc',
  'bankName',
  'accountHolderName',
  'address',
  'emergencyContact',
];

// Process each guard
for (const guard of guards) {
  const guardName = guard.name || guard.id;
  let needsUpdate = false;
  const updates = {};
  
  // Check each PII field
  for (const field of piiFields) {
    const value = guard[field];
    
    // Skip null/empty values
    if (!value) {
      continue;
    }
    
    // Check if already encrypted
    if (isEncrypted(value)) {
      // Already encrypted, skip
      continue;
    }
    
    // Encrypt the value
    try {
      updates[field] = encrypt(value);
      needsUpdate = true;
    } catch (err) {
      console.error(`  ❌ Error encrypting ${field} for ${guardName}: ${err.message}`);
      errorCount++;
    }
  }
  
  // Update the guard if needed
  if (needsUpdate) {
    try {
      // Build UPDATE query dynamically based on which fields need updating
      const updateFields = Object.keys(updates);
      const setClauses = updateFields.map(field => `${field} = @${field}`).join(', ');
      const query = `UPDATE guards SET ${setClauses} WHERE id = @id`;
      
      const stmt = db.prepare(query);
      stmt.run({
        id: guard.id,
        ...updates,
      });
      
      encryptedCount++;
      console.log(`✅ Encrypted PII for: ${guardName} (${updateFields.length} fields)`);
    } catch (err) {
      console.error(`  ❌ Error updating ${guardName}: ${err.message}`);
      errorCount++;
    }
  } else {
    skippedCount++;
    console.log(`⏭️  Skipped: ${guardName} (already encrypted or no PII)`);
  }
}

// Close database
db.close();

// Summary
console.log('\n' + '='.repeat(60));
console.log('Migration Complete!\n');
console.log(`✅ Encrypted: ${encryptedCount} guards`);
console.log(`⏭️  Skipped: ${skippedCount} guards (already encrypted or no PII)`);
if (errorCount > 0) {
  console.log(`❌ Errors: ${errorCount}`);
}
console.log('='.repeat(60));

if (errorCount > 0) {
  process.exit(1);
}
