import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  // Common image types
  const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ];

  // Also allow application/octet-stream which Postman uses for file uploads
  const isImage = allowedMimeTypes.includes(file.mimetype);
  const isBinary = file.mimetype === 'application/octet-stream';

  if (isImage || isBinary) {
    console.log(`Successfully accepted file: ${file.originalname} (${file.mimetype})`);
    callback(null, true);
  } else {
    callback(new Error(`File type ${file.mimetype} is not supported.`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const uploadToCloudinary = (fileBuffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' }, // Force image resource type
      (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url || '');
      }
    );
    uploadStream.end(fileBuffer);
  });
};