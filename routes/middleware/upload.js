import multer from 'multer';
import path from 'path';
import { foundItemsStorage, lostItemsStorage } from '../../config/cloudinary.js';

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);
  if (extName && mimeType) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

// Export multer instances for Cloudinary
export const upload = multer({
  storage: foundItemsStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB (Cloudinary allows larger files)
    files: 5,                   // Max 5 files per request
  },
});

export const uploadLost = multer({
  storage: lostItemsStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 5,                   // Max 5 files per request
  },
});
