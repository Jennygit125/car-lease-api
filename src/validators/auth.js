"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySecurityAnswer = exports.authorizeRoles = exports.isAuthenticated = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const datasource_1 = require("../db/datasource");
const entity = __importStar(require("../controllers/entity"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("../utils/logger");
const isAuthenticated = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        // Updated payload signature from number to string to seamlessly match your User UUID choice
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const userRepo = datasource_1.AppDataSource.getRepository(entity.User);
        // Removed duplicate database calls and variable declarations here
        const found = await userRepo.findOne({ where: { id: decoded.id } });
        if (!found) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        // Sanitize and attach user info
        req.user = { id: found.id, email: found.email, role: found.role };
        next();
    }
    catch (e) {
        if (e.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired, please login again" });
        }
        if (e.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token" });
        }
        return res.status(401).json({ message: "Unauthorized" });
    }
};
exports.isAuthenticated = isAuthenticated;
const authorizeRoles = (...roles) => {
    return async (req, res, next) => {
        // Safety check for user existence
        if (!req.user || !roles.includes(req.user.role)) {
            try {
                const logRepo = datasource_1.AppDataSource.getRepository(entity.LogActivity);
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
            }
            catch (logError) {
                // Fail safe to avoid blocking the response flow if logging fails
                console.error("Failed to write access log:", logError);
            }
            return res.status(403).json({ message: "Forbidden: insufficient permission" });
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
const verifySecurityAnswer = async (req, res) => {
    const { email, securityAnswer } = req.body;
    try {
        const userRepo = datasource_1.AppDataSource.getRepository(entity.User);
        const user = await userRepo.findOne({
            where: { email: email.toLowerCase() },
            select: { id: true, securityAnswerHash: true }
        });
        if (!user || !user.securityAnswerHash) {
            return res.status(401).json({ message: "Invalid request" });
        }
        const isAnswerCorrect = await bcrypt_1.default.compare(securityAnswer.toLowerCase().trim(), user.securityAnswerHash);
        if (!isAnswerCorrect) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        // Return a success flag so the frontend knows it can now show the "New Password" fields
        return res.status(200).json({
            success: true,
            message: "Answer verified",
            // Optional: Generate a short-lived token here to pass to the next step
        });
    }
    catch (error) {
        logger_1.logger.error({ err: error }, "Security answer verification failed");
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.verifySecurityAnswer = verifySecurityAnswer;
