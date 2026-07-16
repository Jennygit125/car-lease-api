import { Request, Response } from 'express';
import { AppDataSource } from '../../db/datasource';
import * as entity from '../entity';


//  LEAVE A REVIEW FOR A VEHICLE

export const addReview = async (req: Request, res: Response) => {
  // #swagger.tags = ['Reviews']
  // #swagger.security = [{ "bearerAuth": [] }]
  const { vehicleId, rating, comment } = req.body;
  const userId = req.user?.id; // Extracted from the authenticated JWT session

  try {
    if (!vehicleId || !rating) {
      return res.status(400).json({ message: 'Vehicle ID and rating are required.' });
    }

    // Ensure rating is valid (1 - 5 stars)
    const starRating = Number(rating);
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
    }

    const vehicleRepo = AppDataSource.getRepository(entity.Vehicle);
    const reviewRepo = AppDataSource.getRepository(entity.Review);

    // Verify the vehicle exists before leaving a review
    const vehicle = await vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    // Double-check if the user already reviewed this vehicle to prevent spam
    const existingReview = await reviewRepo.findOne({ where: { vehicleId, userId } });
    if (existingReview) {
      return res.status(409).json({ message: 'You have already reviewed this vehicle.' });
    }

    const newReview = reviewRepo.create({
      vehicleId,
      userId,
      rating: starRating,
      comment: comment || '',
    });

    const savedReview = await reviewRepo.save(newReview);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: savedReview,
    });
  } catch (error) {
    console.error('Add Review Error:', error);
    return res.status(500).json({ message: 'Internal server error while saving review.' });
  }
};


// GET ALL REVIEWS FOR A SPECIFIC VEHICLE

export const getVehicleReviews = async (req: Request, res: Response) => {
  // #swagger.tags = ['Reviews']
  
  // Explicitly cast params to prevent TypeORM mismatch with string[]
  const { vehicleId } = req.params as { vehicleId: string };

  try {
    const reviewRepo = AppDataSource.getRepository(entity.Review);

    // Fetch all reviews and join the associated user's details safely
    const reviews = await reviewRepo.find({
      where: { vehicleId },
      relations: {
    user: true,
  }, // Join user entity to show who wrote it
      order: { createdAt: 'DESC' },
    });

    // Calculate Average Rating
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 
      ? Number((reviews.reduce((sum: number, r: entity.Review) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 0;

    // Sanitize reviews so we don't leak passwords or sensitive data in the joined 'user' relation
    const sanitizedReviews = reviews.map((review: entity.Review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: {
        id: review.user?.id,
        fullName: review.user?.fullName,
      }
    }));

    return res.status(200).json({
      success: true,
      meta: {
        totalReviews,
        averageRating,
      },
      reviews: sanitizedReviews,
    });
  } catch (error) {
    console.error('Get Reviews Error:', error);
    return res.status(500).json({ message: 'Internal server error fetching reviews.' });
  }
};


//DELETE / MODERATE A REVIEW

export const deleteReview = async (req: Request, res: Response) => {
  // #swagger.tags = ['Reviews']
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params as { id: string };
  const loggedInUserId = req.user?.id;
  const userRole = req.user?.role;

  try {
    const reviewRepo = AppDataSource.getRepository(entity.Review);
    const review = await reviewRepo.findOne({ where: { id } });

    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Guard: Only the author of the review, an Admin, or a CEO can delete it
    if (review.userId !== loggedInUserId && userRole !== 'ADMIN' && userRole !== 'CEO') {
      return res.status(403).json({ message: 'Forbidden: You cannot delete this review.' });
    }

    await reviewRepo.remove(review);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully.',
    });
  } catch (error) {
    console.error('Delete Review Error:', error);
    return res.status(500).json({ message: 'Internal server error deleting review.' });
  }
};