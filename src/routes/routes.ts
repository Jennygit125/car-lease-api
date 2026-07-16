import { Router } from 'express';
import { routes } from './routeCompiler';
import adminRouter from './adminRouter';
import { upload } from '../services/ImageUpload';
// Auth Middleware
import { isAuthenticated,
  verifySecurityAnswer
 } from '../validators/auth'; 

// Controllers
import { 
  authCtrl, 
  vehicleCtrl, 
  reviewCtrl, 
  walletCtrl, 
  bookingCtrl, 
  profileCtrl, 
  transactionCtrl,
  adminCtrl
} from '../controllers/control'; 
import { validateWallet } from '../validators/wallet';

const apiRouter = Router();

// Route Discovery
apiRouter.get('/routes', routes);


// AUTHENTICATION & RECOVERY

apiRouter.post('/auth/register', authCtrl.signUp);
apiRouter.post('/auth/login', authCtrl.signIn);

// Password Recovery Flow
apiRouter.post('/auth/forgot-password/get-question', authCtrl.getRecoveryQuestion);
apiRouter.post('/auth/forgot-password/verify', verifySecurityAnswer);
apiRouter.post('/auth/reset-password', authCtrl.resetPassword);

// User Profile Management
apiRouter.put('/auth/profile', isAuthenticated, profileCtrl.updateProfile);
apiRouter.put('/auth/profile/picture', isAuthenticated, upload.single('profileImage'), profileCtrl.updateProfilePicture);
apiRouter.delete('/auth/profile', isAuthenticated, profileCtrl.deleteAccount);


// ==========================================
// VEHICLE MANAGEMENT
// ==========================================
apiRouter.get('/vehicles', vehicleCtrl.getVehicles);
apiRouter.get('/vehicles/:id', vehicleCtrl.getVehicleById);

//auth vehicles
apiRouter.post('/vehicles', isAuthenticated, upload.array('images'), vehicleCtrl.createVehicle);
apiRouter.put('/vehicles/:id', isAuthenticated, upload.array('images'), vehicleCtrl.updateVehicle);
apiRouter.delete('/vehicles/:id', isAuthenticated, vehicleCtrl.deleteVehicle);


// ==========================================
// REVIEWS
// ==========================================
apiRouter.get('/reviews/vehicle/:vehicleId', reviewCtrl.getVehicleReviews);
apiRouter.post('/reviews', isAuthenticated, reviewCtrl.addReview);
apiRouter.delete('/reviews/:id', isAuthenticated, reviewCtrl.deleteReview);


// ==========================================
// WALLET MANAGEMENT
// ==========================================
apiRouter.get('/wallet', isAuthenticated,validateWallet, walletCtrl.getWallet);
apiRouter.post('/wallet/deposit', isAuthenticated, validateWallet, walletCtrl.depositFunds);
apiRouter.post('/wallet/link-bank', isAuthenticated, validateWallet, walletCtrl.linkBankAccount);
apiRouter.post('/wallet/verify-bank', isAuthenticated, validateWallet, walletCtrl.verifyBankAccount);
apiRouter.post('/wallet/withdraw', isAuthenticated, validateWallet, walletCtrl.withdrawFunds);
apiRouter.get('/wallet/transactions', isAuthenticated, validateWallet, walletCtrl.getTransactionHistory);


// ==========================================
// BOOKING ENGINE
// ==========================================
apiRouter.post('/bookings', isAuthenticated, bookingCtrl.createBooking);
apiRouter.get('/bookings/my-bookings', isAuthenticated, bookingCtrl.getMyBookings);
apiRouter.put('/bookings/:id', isAuthenticated, bookingCtrl.updateBooking); 
apiRouter.post('/bookings/:id/cancel', isAuthenticated, bookingCtrl.cancelBooking);


// ==========================================
// TRANSACTION LEDGER

apiRouter.get('/transactions', isAuthenticated, transactionCtrl.getMyTransactions);
apiRouter.get('/transactions/:identifier', isAuthenticated, transactionCtrl.getTransactionDetails);



// ADMIN LOGIC

apiRouter.use('/admin', adminRouter);

export default apiRouter;