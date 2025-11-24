import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Hotel',
  password: process.env.DB_PASS || '18052004pau',
  port: process.env.DB_PORT || 5432,
});

export default pool;