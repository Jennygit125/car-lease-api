//I decided to store all control logic separately so it's easier to modify and read

// src/controllers/control.ts

export * as authCtrl from './src-control/userControl';
export * as vehicleCtrl from './src-control/vehicleControl';
export * as reviewCtrl from './src-control/reviewControl';
export * as walletCtrl from './src-control/walletControl';
export * as bookingCtrl from './src-control/bookingControl';
export * as transactionCtrl from './src-control/transactionControl';
export * as adminCtrl from './src-control/adminController';
export * as profileCtrl from './src-control/profileControl';

