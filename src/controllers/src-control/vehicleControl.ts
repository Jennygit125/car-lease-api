import { Request, Response } from 'express';
import 'multer';
import { AppDataSource } from '../../db/datasource';
import { Vehicle } from '../entity';
import { uploadToCloudinary } from '../../services/ImageUpload';


//  REGISTER / CREATE A VEHICLE (WITH IMAGES)

export const createVehicle = async (req: Request, res: Response) => {
  // #swagger.tags = ['Vehicles']
  // #swagger.security = [{ "bearerAuth": [] }]
  
  // Telling TypeScript that req contains Multer files
  const multerReq = req as Request & { files: Express.Multer.File[] };
  
  const { brand, model, year, vin, dailyPrice } = multerReq.body;
  const ownerId = multerReq.user?.id; 

  try {
    if (!brand || !model || !year || !vin || !dailyPrice) {
      return res.status(400).json({ message: 'All required vehicle details must be provided' });
    }

    const vehicleRepo = AppDataSource.getRepository(Vehicle);

    const existingVin = await vehicleRepo.findOne({ where: { vin } });
    if (existingVin) {
      return res.status(409).json({ message: 'A vehicle with this VIN is already registered' });
    }

    // Process image uploads if files are present
    let imageUrls: string[] = [];
    if (multerReq.files && Array.isArray(multerReq.files)) {
      const uploadPromises = multerReq.files.map((file) => 
        uploadToCloudinary(file.buffer, 'vehicles')
      );
      imageUrls = await Promise.all(uploadPromises);
    }

    const newVehicle = vehicleRepo.create({
      brand,
      model,
      year: Number(year),
      vin,
      dailyPrice: Number(dailyPrice),
      images: imageUrls, 
      ownerId,
    });

    const savedVehicle = await vehicleRepo.save(newVehicle);

    return res.status(201).json({
      success: true,
      message: 'Vehicle registered with images successfully',
      vehicle: savedVehicle,
    });
  } catch (error: any) {
    console.error('Add Vehicle Error:', error);
    return res.status(500).json({ message: 'Internal server error while saving vehicle' });
  }
};


// GET ALL VEHICLES (PAGINATED & FILTERED)

export const getVehicles = async (req: Request, res: Response) => {
  // #swagger.tags = ['Vehicles']
  const { brand, availableOnly } = req.query;

  try {
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    
    // Build dynamic query conditions
    const queryConditions: any = {};
    
    if (brand) {
      queryConditions.brand = String(brand);
    }
    
    if (availableOnly === 'true') {
      queryConditions.isAvailable = true;
    }

    // TypeORM automatically handles soft-delete filtering (deletedAt IS NULL)
    const vehicles = await vehicleRepo.find({
      where: queryConditions,
      order: { createdAt: 'DESC' },
    });

    return res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error('Get Vehicles Error:', error);
    return res.status(500).json({ message: 'Internal server error fetching vehicles' });
  }
};


// GET VEHICLE BY ID

export const getVehicleById = async (req: Request, res: Response) => {
  // #swagger.tags = ['Vehicles']
  const { id } = req.params as { id: string };

  try {
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const vehicle = await vehicleRepo.findOne({ where: { id } });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    return res.status(200).json({
      success: true,
      vehicle,
    });
  } catch (error) {
    console.error('Get Vehicle By ID Error:', error);
    return res.status(500).json({ message: 'Internal server error retrieving vehicle detail.' });
  }
};


// UPDATE VEHICLE DETAILS (WITH OPTIONAL IMAGE UPLOAD)

export const updateVehicle = async (req: Request, res: Response) => {
  // #swagger.tags = ['Vehicles']
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params as { id: string };
  const loggedInUserId = req.user?.id;
  const userRole = req.user?.role;

  const multerReq = req as Request & { files: Express.Multer.File[] };
  const { brand, model, year, vin, dailyPrice, isAvailable } = multerReq.body;

  try {
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const vehicle = await vehicleRepo.findOne({ where: { id } });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    // Authorization Guard
    if (vehicle.ownerId !== loggedInUserId && userRole !== 'ADMIN' && userRole !== 'CEO') {
      return res.status(403).json({ message: 'Forbidden: You do not own this vehicle.' });
    }

    // Update textual properties if provided
    if (brand) vehicle.brand = brand;
    if (model) vehicle.model = model;
    if (year) vehicle.year = Number(year);
    if (vin) vehicle.vin = vin;
    if (dailyPrice) vehicle.dailyPrice = Number(dailyPrice);
    if (isAvailable !== undefined) vehicle.isAvailable = isAvailable === 'true' || isAvailable === true;

    // Handle new images if uploaded
    if (multerReq.files && Array.isArray(multerReq.files) && multerReq.files.length > 0) {
      const uploadPromises = multerReq.files.map((file) => 
        uploadToCloudinary(file.buffer, 'vehicles')
      );
      const newImageUrls = await Promise.all(uploadPromises);
      // Append new images to existing ones, or replace them based on your business choice
      vehicle.images = [...(vehicle.images || []), ...newImageUrls];
    }

    const updatedVehicle = await vehicleRepo.save(vehicle);

    return res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully.',
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error('Update Vehicle Error:', error);
    return res.status(500).json({ message: 'Internal server error updating vehicle metadata.' });
  }
};


// REMOVE / SOFT-DELETE A VEHICLE

export const deleteVehicle = async (req: Request, res: Response) => {
  // #swagger.tags = ['Vehicles']
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params as { id: string };
  const loggedInUserId = req.user?.id;
  const userRole = req.user?.role;

  try {
    const vehicleRepo = AppDataSource.getRepository(Vehicle);
    const vehicle = await vehicleRepo.findOne({ where: { id } });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Safety Guard: Only the vehicle owner, an Admin, or a CEO can delete this vehicle
    if (vehicle.ownerId !== loggedInUserId && userRole !== 'ADMIN' && userRole !== 'CEO') {
      return res.status(403).json({ message: 'Forbidden: You do not own this vehicle' });
    }

    // Executes softRemove to populate the 'deletedAt' timestamp instead of dropping the row
    await vehicleRepo.softRemove(vehicle);

    return res.status(200).json({
      success: true,
      message: 'Vehicle removed successfully (archived)',
    });
  } catch (error) {
    console.error('Delete Vehicle Error:', error);
    return res.status(500).json({ message: 'Internal server error deleting vehicle' });
  }
};