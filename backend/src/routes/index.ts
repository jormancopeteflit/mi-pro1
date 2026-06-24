/**
 * Central route registry.
 */
import { Router } from 'express';
import authRouter from './auth';
import devicesRouter from './devices';
import syncRouter from './sync';

const router = Router();

router.use('/auth', authRouter);
router.use('/devices', devicesRouter);
router.use('/sync', syncRouter);

export default router;
