import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { profileRoutes } from './profiles.js';
import { authRoutes } from './auth.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/profiles', profileRoutes);

routes.get('/kotgroepen', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('kotgroups')
      .select('id, name, address, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
