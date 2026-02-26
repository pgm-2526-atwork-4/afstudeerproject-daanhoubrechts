import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const profileRoutes = Router();

profileRoutes.get('/me', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: 'Profiel niet gevonden.' });
    return;
  }

  res.json(data);
});

profileRoutes.patch('/me', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  // alleen whitelisted velden doorlaten
  const { first_name, last_name, phone_number, notifications, light_dark_mode, avatar_url } =
    req.body as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  if (first_name !== undefined) update['first_name'] = first_name;
  if (last_name !== undefined) update['last_name'] = last_name;
  if (phone_number !== undefined) update['phone_number'] = phone_number;
  if (notifications !== undefined) update['notifications'] = notifications;
  if (light_dark_mode !== undefined) update['light_dark_mode'] = light_dark_mode;
  if (avatar_url !== undefined) update['avatar_url'] = avatar_url;

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: 'Geen geldige velden meegegeven.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});
