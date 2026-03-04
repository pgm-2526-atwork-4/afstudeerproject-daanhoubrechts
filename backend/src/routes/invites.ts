import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const invitesRoutes = Router();

// invite info opvragen op basis van token (geen auth nodig)
invitesRoutes.get('/:token', async (req, res) => {
  try {
    const token = req.params['token'];

    if (!token) {
      res.status(400).json({ error: 'Token ontbreekt.' });
      return;
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('kotgroup_invites')
      .select('id, kotgroup_id, expires_at, max_uses, used_count')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) {
      res.status(500).json({ error: inviteError.message });
      return;
    }
    if (!invite) {
      res.status(404).json({ error: 'Uitnodiging is ongeldig of niet gevonden.' });
      return;
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'Uitnodiging is verlopen.' });
      return;
    }
    if (invite.max_uses !== null && invite.max_uses !== undefined && invite.used_count >= invite.max_uses) {
      res.status(410).json({ error: 'Uitnodiging is niet meer geldig.' });
      return;
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from('kotgroups')
      .select('id, name, address')
      .eq('id', invite.kotgroup_id)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: 'Kotgroep niet gevonden voor deze uitnodiging.' });
      return;
    }

    res.json({
      kotgroup_id: group.id,
      name: group.name,
      address: group.address,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// uitnodiging accepteren en user toevoegen aan kotgroup
invitesRoutes.post('/:token/accept', requireAuth, async (req, res) => {
  try {
    const token = req.params['token'];
    const userId = req.user!.id;

    if (!token) {
      res.status(400).json({ error: 'Token ontbreekt.' });
      return;
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('kotgroup_invites')
      .select('id, kotgroup_id, expires_at, max_uses, used_count')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) {
      res.status(500).json({ error: inviteError.message });
      return;
    }
    if (!invite) {
      res.status(404).json({ error: 'Uitnodiging is ongeldig of niet gevonden.' });
      return;
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'Uitnodiging is verlopen.' });
      return;
    }
    if (invite.max_uses !== null && invite.max_uses !== undefined && invite.used_count >= invite.max_uses) {
      res.status(410).json({ error: 'Uitnodiging is niet meer geldig.' });
      return;
    }

    // check of user al lid is
    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('kotgroup_members')
      .select('user_id, kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', invite.kotgroup_id)
      .maybeSingle();

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }

    if (!existingMember) {
      const { error: insertError } = await supabaseAdmin
        .from('kotgroup_members')
        .insert({ user_id: userId, kotgroup_id: invite.kotgroup_id });

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }
    }

    // gebruik tellen
    const { error: updateError } = await supabaseAdmin
      .from('kotgroup_invites')
      .update({ used_count: invite.used_count + 1 })
      .eq('id', invite.id);

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json({ success: true, kotgroup_id: invite.kotgroup_id });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

