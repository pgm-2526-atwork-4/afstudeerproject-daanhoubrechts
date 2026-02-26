import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { profileRoutes } from './profiles.js';
import { authRoutes } from './auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/profiles', profileRoutes);

routes.get('/kotgroepen', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { data, error } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const kotgroupIds = (data ?? []).map((r) => r.kotgroup_id);
    if (kotgroupIds.length === 0) {
      res.json([]);
      return;
    }
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('kotgroups')
      .select('id, name, address, created_at')
      .in('id', kotgroupIds)
      .order('created_at', { ascending: false });
    if (groupsError) {
      res.status(500).json({ error: groupsError.message });
      return;
    }
    res.json(groups ?? []);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
