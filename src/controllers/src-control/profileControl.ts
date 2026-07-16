import { Request, Response } from 'express';
import { AppDataSource } from '../../db/datasource';
import { User } from '../entity';
import { uploadToCloudinary } from '../../services/ImageUpload';

export const updateProfilePicture = async (req: Request, res: Response) => {
  // #swagger.tags = ['User Profile']
  // #swagger.security = [{ "bearerAuth": [] }]
  const userId = req.user?.id;
  
  const multerReq = req as Request & { file?: Express.Multer.File };

  try {
    if (!multerReq.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Upload buffer to Cloudinary in the 'profiles' folder
    const imageUrl = await uploadToCloudinary(multerReq.file.buffer, 'profiles');

    // Update entity
    user.profileImage = imageUrl;
    await userRepo.save(user);

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully.',
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error('Update Profile Picture Error:', error);
    return res.status(500).json({ message: 'Failed to update profile picture.' });
  }
};
// Update User Profile (e.g., fullName)
export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { fullName } = req.body;

  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Sanitize: Ensure name isn't just empty spaces
    if (fullName && fullName.trim().length > 0) {
      user.fullName = fullName.trim();
    }

    await userRepo.save(user);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: { fullName: user.fullName, email: user.email }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
};

// Soft Delete User Account
export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Soft delete logic
    user.isActive = false; 
    await userRepo.save(user);

    return res.status(200).json({
      success: true,
      message: 'Account deactivated successfully.'
    });
  } catch (error) {
    console.error('Delete Account Error:', error);
    return res.status(500).json({ message: 'Failed to deactivate account.' });
  }
};