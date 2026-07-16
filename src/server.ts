import 'reflect-metadata'; 
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import process from 'process';

// Importing Data Source, Jobs, and Routes
import { AppDataSource } from './db/datasource';
import { startBookingStatusScheduler } from './jobs/bookingScheduler';
import apiRouter from './routes/routes';

dotenv.config();

const app: Application = express();
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;


const connectWithRetry = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');
  } catch (err) {
    console.error(' Error during Data Source initialization, retrying in 5s...', err);
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// --- Security & Utility Middlewares ---
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later.' }
}));

//Swagger
const swaggerPath = path.join(process.cwd(), 'swagger.json');

if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf-8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// --- Routes ---
app.use('/', apiRouter);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'success', message: 'AutoLease API is live.' });
});


// --- Server & Database Initialization ---
AppDataSource.initialize()
  .then(() => {
    console.log(' Database connection established.');
    startBookingStatusScheduler();
    
    app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
  })
  .catch((error) => {
    console.error(' Server startup failed:', error);
    process.exit(1);
  });