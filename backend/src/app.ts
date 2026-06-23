import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './auth/auth.controller';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/auth', authRouter);

export default app;
