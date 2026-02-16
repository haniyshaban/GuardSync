# Production Deployment Checklist - PII Encryption

Use this checklist before deploying the PII encryption system to production.

## 🔐 Pre-Deployment Security Checklist

### 1. Encryption Key Setup

- [ ] Generated a NEW unique encryption key for production
  - Run: `node guardsync-admin/server/generate-key.js`
  - KEY MUST BE: 64 hexadecimal characters (32 bytes)
  
- [ ] Stored production key in secure secret management
  - ✅ AWS Secrets Manager
  - ✅ Azure Key Vault
  - ✅ HashiCorp Vault
  - ✅ Google Cloud Secret Manager
  - ❌ NOT in code
  - ❌ NOT in docker-compose.yml committed to git
  - ❌ NOT in .env file in repository

- [ ] Created secure backup of encryption key
  - Stored separately from database backups
  - Accessible only to authorized personnel
  - Documented key recovery procedure

- [ ] Different keys for each environment
  - [ ] Development key
  - [ ] Staging key (if applicable)
  - [ ] Production key
  - [ ] Keys are NOT the same

### 2. Environment Configuration

- [ ] Set `NODE_ENV=production` in production environment
  - Application will enforce ENCRYPTION_KEY requirement

- [ ] Verified `ENCRYPTION_KEY` is set in production environment
  - Check: Application starts successfully
  - Check: No warnings about using dev key in logs

- [ ] Removed or secured .env files
  - .env files NOT committed to git
  - .gitignore includes .env, .env.local, .env.production

### 3. Data Migration

- [ ] Backed up database before migration
  - Database backup created: _________________ (date)
  - Backup verified and tested
  - Backup stored securely

- [ ] Ran migration script on staging/test environment first
  - Command: `node server/migrate-encrypt-pii.js`
  - Verified: All PII fields encrypted
  - Verified: Application reads data correctly
  - No errors in migration

- [ ] Ran migration script on production database
  - Migration completed successfully
  - All guards processed
  - Logged: Date/time of migration
  - Verified: Data decrypts correctly

- [ ] Verified encrypted data in database
  ```bash
  sqlite3 server/data/gw.db "SELECT aadharNumber FROM guards LIMIT 1;"
  # Should see: "base64string:base64string:base64string" format
  ```

### 4. Application Testing

- [ ] Tested guard enrollment (write operations)
  - New guard PII is encrypted in database
  - API returns decrypted data correctly
  - Masked fields show only last 4 digits

- [ ] Tested guard profile retrieval (read operations)
  - Existing guard PII decrypts correctly
  - No decryption errors in logs
  - Response times acceptable

- [ ] Tested guard profile updates
  - Updated PII re-encrypts with new IV
  - No data corruption
  - Old encrypted data still readable

- [ ] Ran encryption test suite
  ```bash
  cd guardsync-admin
  node server/test-encryption.js
  ```
  - [ ] All tests passed

### 5. Security Hardening

- [ ] Reviewed code for hardcoded secrets
  - No encryption keys in code
  - No database credentials in code
  - No API keys in code

- [ ] Verified file permissions
  - Database file: Restricted access
  - Config files: Restricted access
  - Upload directories: Restricted access

- [ ] Implemented audit logging (if required)
  - Log PII access events
  - Log decryption operations
  - Log encryption key access

- [ ] Configured HTTPS for all API traffic
  - Prevents PII interception in transit
  - Valid SSL/TLS certificate

### 6. Compliance Verification

- [ ] **India's Aadhaar Act Compliance**
  - [ ] Aadhar numbers encrypted at rest ✅
  - [ ] Aadhar numbers encrypted in transit (HTTPS)
  - [ ] Access controls for Aadhar data
  - [ ] Consent mechanism (if applicable)
  - [ ] Data retention policy documented

- [ ] **GDPR Compliance (if applicable)**
  - [ ] PII encrypted
  - [ ] Right to erasure (delete guard)
  - [ ] Data portability (export functionality)
  - [ ] Consent tracking
  - [ ] Privacy policy updated

### 7. Documentation & Training

- [ ] Documented encryption key rotation procedure
- [ ] Documented key recovery process
- [ ] Documented incident response for key compromise
- [ ] Trained team on security procedures
- [ ] Created runbook for common issues

### 8. Monitoring & Alerts

- [ ] Set up monitoring for decryption errors
  - Alert on repeated decryption failures
  - Log analysis for security events

- [ ] Set up monitoring for application errors
  - Missing ENCRYPTION_KEY error
  - Database access errors
  - Unauthorized access attempts

- [ ] Configured log aggregation
  - Centralized logging (Splunk, ELK, CloudWatch, etc.)
  - Security event monitoring
  - PII access auditing

### 9. Backup & Recovery

- [ ] Database backup strategy in place
  - Frequency: _________________ (daily/weekly)
  - Retention: _________________ (30/60/90 days)
  - Encrypted backups
  - Tested restoration

- [ ] Encryption key backup strategy
  - Keys stored separately from database
  - Multiple secure locations
  - Access restricted to authorized personnel
  - Key recovery tested

- [ ] Disaster recovery plan
  - RTO (Recovery Time Objective): _________________
  - RPO (Recovery Point Objective): _________________
  - Restoration procedure documented
  - Recovery tested

### 10. Deployment

- [ ] Performed deployment in maintenance window
- [ ] Notified users of maintenance (if applicable)
- [ ] Deployed application with encryption enabled
- [ ] Verified application health post-deployment
- [ ] Monitored logs for errors (first 24 hours)
- [ ] Verified guard data accessible
- [ ] Verified new enrollments work correctly

## ⚠️ Critical Warnings

### DO NOT Proceed if:
- ❌ Encryption key is not backed up securely
- ❌ Database is not backed up
- ❌ Testing has not been completed
- ❌ Team is not trained on key management
- ❌ Key recovery procedure is not documented

### If Something Goes Wrong:
1. **Application won't start**: Check ENCRYPTION_KEY is set correctly
2. **Decryption errors**: Verify correct encryption key is in use
3. **Corrupted data**: Restore from backup and re-run migration
4. **Lost encryption key**: Data is permanently lost (restore from backup if available)

## 📝 Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | _____________ | _____________ | _______ |
| DevOps | _____________ | _____________ | _______ |
| Security | _____________ | _____________ | _______ |
| Management | _____________ | _____________ | _______ |

## 📅 Post-Deployment

- [ ] Day 1: Monitor for errors and performance issues
- [ ] Week 1: Review logs and audit trails
- [ ] Month 1: Verify backup/restore procedures
- [ ] Month 3: Review and plan key rotation (if needed)

## 🔄 Key Rotation Schedule

Plan for regular key rotation:
- **Frequency**: Every _____________ months
- **Next rotation**: _____________
- **Procedure**: See key rotation documentation

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Verified By**: _____________  

---

## Additional Resources

- [PII-ENCRYPTION-GUIDE.md](./PII-ENCRYPTION-GUIDE.md) - Complete documentation
- [PII-ENCRYPTION-QUICKSTART.md](./PII-ENCRYPTION-QUICKSTART.md) - Quick reference
- [guardsync-admin/.env.example](./guardsync-admin/.env.example) - Environment template

**Questions or Issues?** Contact: _____________
