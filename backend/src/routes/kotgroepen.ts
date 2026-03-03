import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const kotgroepenRoutes = Router();

// alle kotgroepen van de ingelogde user
kotgroepenRoutes.get('/', requireAuth, async (req, res) => {
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
      .select('id, name, address, created_at, created_by')
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

// detail van één kotgroep (user moet lid zijn)
kotgroepenRoutes.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.params['id'];

    const { data: membership, error: memberError } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', kotgroupId)
      .maybeSingle();

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }
    if (!membership) {
      res.status(403).json({ error: 'Geen toegang tot deze kotgroep.' });
      return;
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from('kotgroups')
      .select('id, name, address, created_at, created_by, rules, wifi_ssid, wifi_password')
      .eq('id', kotgroupId)
      .single();

    if (groupError) {
      res.status(500).json({ error: groupError.message });
      return;
    }

    res.json(group);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// nieuwe kotgroep aanmaken (alleen kotbaas)
kotgroepenRoutes.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // rol checken via profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(500).json({ error: 'Profiel niet gevonden.' });
      return;
    }
    if (profile.role !== 'kotbaas') {
      res.status(403).json({ error: 'Alleen een kotbaas kan een kotgroep aanmaken.' });
      return;
    }

    const { name, address } = req.body as { name?: string; address?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: 'Naam is verplicht.' });
      return;
    }

    const { data: group, error: insertError } = await supabaseAdmin
      .from('kotgroups')
      .insert({ name: name.trim(), address: address?.trim() || null, created_by: userId })
      .select('id, name, address, created_at, created_by')
      .single();

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    // kotbaas zelf ook als lid toevoegen
    const { error: memberError } = await supabaseAdmin
      .from('kotgroup_members')
      .insert({ user_id: userId, kotgroup_id: group.id });

    if (memberError) {
      res.status(500).json({ error: memberError.message });
      return;
    }

    res.status(201).json(group);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// regels en wifi aanpassen (alleen de kotbaas die de groep aangemaakt heeft)
kotgroepenRoutes.patch('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.params['id'];

    const { data: group, error: groupError } = await supabaseAdmin
      .from('kotgroups')
      .select('created_by')
      .eq('id', kotgroupId)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: 'Kotgroep niet gevonden.' });
      return;
    }
    if (group.created_by !== userId) {
      res.status(403).json({ error: 'Alleen de kotbaas kan dit aanpassen.' });
      return;
    }

    const allowedFields = ['rules', 'wifi_ssid', 'wifi_password'] as const;
    const update: Record<string, string | null> = {};

    for (const field of allowedFields) {
      if (field in req.body) {
        update[field] = req.body[field] ?? null;
      }
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: 'Geen geldige velden om aan te passen.' });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('kotgroups')
      .update(update)
      .eq('id', kotgroupId)
      .select('id, name, address, created_at, created_by, rules, wifi_ssid, wifi_password')
      .single();

    if (updateError) {
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
