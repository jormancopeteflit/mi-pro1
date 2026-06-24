import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRouter from './auth/authRouter';
import syncRouter from './sync/syncRouter';
import pushRouter from './push/pushRouter';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);
app.use('/sync', syncRouter);
app.use('/push', pushRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

export default app;
