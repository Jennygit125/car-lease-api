import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// importing all entities
import * as Entities from '../controllers/entity'; 

dotenv.config();
//removes any non class
const entityClasses = Object.values(Entities).filter(
  (item) => typeof item === 'function'
) as any[];

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false, 
  logging: process.env.NODE_ENV === 'development',
  
  // Convert the Entities object into an array of classes for TypeORM
  entities: entityClasses,
  
  migrations: [],
  subscribers: [],
});