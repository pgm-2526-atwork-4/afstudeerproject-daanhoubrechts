import { Router } from 'express';
import { profileRoutes } from './profiles.js';
import { authRoutes } from './auth.js';
import { kotgroepenRoutes } from './kotgroepen.js';
import { invitesRoutes } from './invites.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/profiles', profileRoutes);
routes.use('/kotgroepen', kotgroepenRoutes);
routes.use('/invites', invitesRoutes);
