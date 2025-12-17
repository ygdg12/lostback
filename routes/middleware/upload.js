import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDirExists(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);
  if (extName && mimeType) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

function createStorage(uploadPath) {
  ensureDirExists(uploadPath);
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `image-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });
}

// Save uploads under backend/uploads/found-items (served by server.js at /uploads)
const foundItemsUploadPath = path.resolve(__dirname, '../../uploads/found-items');
const lostItemsUploadPath = path.resolve(__dirname, '../../uploads/lost-items');

// Export multer instances
export const upload = multer({
  storage: createStorage(foundItemsUploadPath),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5,                  // Max 5 files per request
  },
});

export const uploadLost = multer({
  storage: createStorage(lostItemsUploadPath),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5,                  // Max 5 files per request
  },
});
