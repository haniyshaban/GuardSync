import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup file upload storage
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'application/pdf': '.pdf' };

// The first bytes of each allowed file type. The type a browser claims can be faked; these cannot.
const SIGNATURES = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

/** Reads the start of a saved file and returns its real type, or null if it is not an allowed one. */
export const detectFileType = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    return SIGNATURES.find((sig) => sig.bytes.every((b, i) => head[i] === b))?.type || null;
  } finally {
    fs.closeSync(fd);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unguessable name; the extension comes from the allowed type, not from the uploader
    const ext = EXTENSIONS[file.mimetype] || '';
    cb(null, file.fieldname + '-' + crypto.randomBytes(16).toString('hex') + ext);
  }
});

export const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and PDF are allowed.'));
    }
  }
});

export const UPLOAD_DIR = uploadDir;
