import { Router } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const authRoutes = Router();

authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email en wachtwoord zijn verplicht.' });
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    res.status(401).json({ error: error?.message ?? 'Inloggen mislukt.' });
    return;
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  });
});

const ALLOWED_ROLES = ['kotgenoot', 'kotbaas'];

authRoutes.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, role } = req.body as {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: string;
  };

  if (!email || !password || !first_name || !last_name) {
    res.status(400).json({ error: 'Alle velden zijn verplicht.' });
    return;
  }

  const profileRole = role && ALLOWED_ROLES.includes(role) ? role : 'kotgenoot';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // DB trigger gebruikt deze metadata om het profiel aan te maken
    options: { data: { first_name, last_name, role: profileRole } },
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  // Trigger maakt profiel aan maar zet role niet uit metadata; wij zetten role expliciet
  // light_dark_mode altijd false bij nieuw account, geen default uit OS of DB die dark forceert
  if (data.user) {
    await supabaseAdmin
      .from('profiles')
      .update({ role: profileRole, light_dark_mode: false })
      .eq('id', data.user.id);
  }

  if (!data.session) {
    // email confirmation aan, nog geen sessie beschikbaar
    res.status(200).json({ message: 'Controleer je email om je account te bevestigen.' });
    return;
  }

  res.status(201).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user!.id, email: data.user!.email },
  });
});

authRoutes.post('/logout', requireAuth, async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.user!.id);
  } catch {
    // logout mag falen, de frontend wist de tokens sowieso
  }
  res.json({ success: true });
});

authRoutes.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body as { refresh_token: string };

  if (!refresh_token) {
    res.status(400).json({ error: 'Refresh token ontbreekt.' });
    return;
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    res.status(401).json({ error: 'Sessie verlopen, opnieuw inloggen.' });
    return;
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
});

authRoutes.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body as {
    current_password: string;
    new_password: string;
  };

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Huidig en nieuw wachtwoord zijn verplicht.' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 6 tekens zijn.' });
    return;
  }

  // huidig wachtwoord verifiëren via sign-in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: req.user!.email!,
    password: current_password,
  });

  if (signInError) {
    res.status(401).json({ error: 'Huidig wachtwoord klopt niet.' });
    return;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.id, {
    password: new_password,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

authRoutes.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user!.id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Profiel niet gevonden.' });
    return;
  }

  res.json({
    user: { id: req.user!.id, email: req.user!.email },
    profile: data,
  });
});
