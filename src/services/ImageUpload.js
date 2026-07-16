"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = multer_1.default.memoryStorage();
// More permissive filter for valid image formats
const fileFilter = (req, file, callback) => {
    // Common image types
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    // Also allow 'application/octet-stream' which Postman often uses for file uploads
    const isImage = allowedMimeTypes.includes(file.mimetype);
    const isBinary = file.mimetype === 'application/octet-stream';
    if (isImage || isBinary) {
        console.log(`Successfully accepted file: ${file.originalname} (${file.mimetype})`);
        callback(null, true);
    }
    else {
        callback(new Error(`File type ${file.mimetype} is not supported.`), false);
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: 'image' }, // Force 'image' resource type
        (error, result) => {
            if (error)
                return reject(error);
            resolve(result?.secure_url || '');
        });
        uploadStream.end(fileBuffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
