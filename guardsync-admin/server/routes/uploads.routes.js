import express from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../auth.js';
import { upload, UPLOAD_DIR } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { success, badRequest, notFound, serverError } from '../utils/responses.js';
import logger from '../logger.js';

const router = express.Router();

// Secure file serving (authenticated)
router.get('/:filename', authMiddleware(true), (req, res) => {
  try {
    const file = path.basename(req.params.filename);
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
