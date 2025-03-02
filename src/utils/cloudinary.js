import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_USERNAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadFileOnCloudinary = async (filePath) => {
    try {
        const uploadResult = await cloudinary.uploader.upload(filePath);
        return uploadResult;
    } catch (error) {
        return error;
    }
}

export { uploadFileOnCloudinary };