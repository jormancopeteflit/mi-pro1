/**
 * Express application setup.
 */
import express, { Request, Response, NextFunction } from 'express';
import routes from './routes/index';

const app = express();

app.use(express.json());

// Mount all API routes
app.use('/api', routes);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
