import { Router } from 'express';
import { adminCtrl } from '../controllers/control';
import { isAuthenticated, authorizeRoles } from '../validators/auth';

const adminRouter = Router();

// Apply these to all routes in this file
adminRouter.use(isAuthenticated, authorizeRoles('admin', 'ceo'));

adminRouter.get('/metrics', adminCtrl.getSystemMetrics);
adminRouter.get('/users', adminCtrl.getAllUsersReport);
adminRouter.post('/users/:id/suspend', adminCtrl.suspendUser);
adminRouter.post('/users/:id/activate', adminCtrl.activateUser);
adminRouter.delete('/users/:id', adminCtrl.deleteUserAccount);
adminRouter.get('/audit-logs', adminCtrl.getAuditLogs);
adminRouter.get('/revenue-report', adminCtrl.getCEORevenueReport);

export default adminRouter;