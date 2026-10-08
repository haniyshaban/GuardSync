import express from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../auth.js';
import { upload, UPLOAD_DIR, detectFileType } from '../middleware/upload.js';
import db from '../db.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { success, badRequest, notFound, forbidden, serverError } from '../utils/responses.js';
import logger from '../logger.js';

const router = express.Router();

// Secure file serving (authenticated)
router.get('/:filename', authMiddleware(true), (req, res) => {
  try {
    const file = path.basename(req.params.filename);
    // Staff and admin can open any document. A guard can only open the ones on their own record.
    if (req.user?.role === 'guard') {
      const own = db.prepare('SELECT photographUrl, aadharDocUrl, panDocUrl, relievingLetterUrl FROM guards WHERE id = ?').get(req.user.id);
      const mine = own && Object.values(own).some((url) => typeof url === 'string' && path.basename(url) === file);
      if (!mine) return forbidden(res, 'You can only open your own documents');
    }
    const fullPath = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(fullPath)) {
      return notFound(res, 'file', req.params.filename);
    }
    res.sendFile(fullPath);
  } catch (e) {
    return serverError(res, String(e));
  }
});

// File upload endpoint
router.post('/', uploadLimiter, authMiddleware(true), upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return badRequest(res, 'No file uploaded');
    }

    // Check what the file really is, and throw it away if it is not what it claims to be
    const realType = detectFileType(req.file.path);
    if (!realType || realType !== req.file.mimetype) {
      fs.unlinkSync(req.file.path);
      return badRequest(res, 'Invalid file type. Only JPEG, PNG, GIF and PDF are allowed.');
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    logger.info({ 
      filename: req.file.filename, 
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, 'File uploaded');
    
    return success(res, {
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    logger.error({ err }, 'File upload failed');
    return serverError(res, String(err));
  }
});

export default router;
