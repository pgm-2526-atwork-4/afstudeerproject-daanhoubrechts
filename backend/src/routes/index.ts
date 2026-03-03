import { Router } from 'express';
import { profileRoutes } from './profiles.js';
import { authRoutes } from './auth.js';
import { kotgroepenRoutes } from './kotgroepen.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/profiles', profileRoutes);
routes.use('/kotgroepen', kotgroepenRoutes);
