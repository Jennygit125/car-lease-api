import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../db/datasource";
import * as entity from "../controllers/entity";
import bcrypt from "bcrypt";
import { logger } from '../utils/logger';


 // Extending Express Request type to include 'user'
 declare global {
   namespace Express {
     interface Request {
       user?: {
        id: string; 
        email: string;
        role: string;
       };
     }
   }
 } // Fixed missing closing brackets for namespace and declare global
 
 export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
   const authHeader = req.headers.authorization;
 
   if (!authHeader || !authHeader.startsWith("Bearer ")) {
     return res.status(401).json({ message: "No token provided" });
   }
 
   const token = authHeader.split(" ")[1];
 
   try {
     // Updated payload signature from number to string to seamlessly match your User UUID choice
     const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

     const userRepo = AppDataSource.getRepository(entity.User);
     
     // Removed duplicate database calls and variable declarations here
     const found = await userRepo.findOne({ where: { id: decoded.id } });
     if (!found) {
       return res.status(401).json({ message: "User no longer exists" });
     }

    // Sanitize and attach user info
    req.user = { id: found.id, email: found.email, role: found.role };
    next();

   } catch (e: any) {
     if (e.name === "TokenExpiredError") {
       return res.status(401).json({ message: "Token expired, please login again" });
     }
     if (e.name === "JsonWebTokenError") {
       return res.status(401).json({ message: "Invalid token" });
     }
     return res.status(401).json({ message: "Unauthorized" });
   }
 };
 
 export const authorizeRoles = (...roles: string[]) => {
   return async (req: Request, res: Response, next: NextFunction) => {
     // Safety check for user existence
     if (!req.user || !roles.includes(req.user.role)) {
      try {
        
        const logRepo = AppDataSource.getRepository(entity.LogActivity);
        await logRepo.save({
          action: "FORBIDDEN_ACCESS",
          userId: req.user?.id || null,
          ipAddress: req.ip || "",
          metaData: {
            method: req.method,
            path: req.originalUrl,
            role: req.user?.role,
            allowedRoles: roles
          }
        });
      } catch (logError) {
        // Fail safe to avoid blocking the response flow if logging fails
        console.error("Failed to write access log:", logError);
      }

      return res.status(403).json({ message: "Forbidden: insufficient permission" });
    }
    next();
  };
};

export const verifySecurityAnswer = async (req: Request, res: Response) => {
  const { email, securityAnswer } = req.body;

  try {
    const userRepo = AppDataSource.getRepository(entity.User);
    const user = await userRepo.findOne({ 
      where: { email: email.toLowerCase() },
      select: { id: true, securityAnswerHash: true } 
    });

    if (!user || !user.securityAnswerHash) {
      return res.status(401).json({ message: "Invalid request" });
    }

    const isAnswerCorrect = await bcrypt.compare(
      securityAnswer.toLowerCase().trim(),
      user.securityAnswerHash
    );

    if (!isAnswerCorrect) {
      return res.status(401).json({ message: "Incorrect security answer" });
    }

    // Return a success flag so the frontend knows it can now show the "New Password" fields
    return res.status(200).json({ 
      success: true, 
      message: "Answer verified",
      // Optional: Generate a short-lived token here to pass to the next step
    });
  } catch (error) {
    logger.error({ err: error }, "Security answer verification failed");
    return res.status(500).json({ message: "Internal server error" });
  }
};