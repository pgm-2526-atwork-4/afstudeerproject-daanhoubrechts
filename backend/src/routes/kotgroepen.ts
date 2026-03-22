import { Router } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Alleen PDF bestanden zijn toegestaan.'));
  },
});

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

    const allowedFields = ['name', 'address', 'rules', 'wifi_ssid', 'wifi_password'] as const;
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

// leden van een kotgroep ophalen (user moet lid zijn)
kotgroepenRoutes.get('/:id/members', requireAuth, async (req, res) => {
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
      .select('created_by')
      .eq('id', kotgroupId)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: 'Kotgroep niet gevonden.' });
      return;
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('kotgroup_members')
      .select('user_id')
      .eq('kotgroup_id', kotgroupId);

    if (membersError) {
      res.status(500).json({ error: membersError.message });
      return;
    }

    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      res.json({ members: [], kotbaas_id: group.created_by });
      return;
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, role')
      .in('id', userIds);

    if (profilesError) {
      res.status(500).json({ error: profilesError.message });
      return;
    }

    res.json({ members: profiles ?? [], kotbaas_id: group.created_by });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// helper: controleer of user kotbaas is van een groep
async function isKotbaas(userId: string, kotgroupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('kotgroups')
    .select('created_by')
    .eq('id', kotgroupId)
    .single();
  return data?.created_by === userId;
}

// helper: controleer of user lid is van een groep
async function isMember(userId: string, kotgroupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('kotgroup_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('kotgroup_id', kotgroupId)
    .maybeSingle();
  return !!data;
}

// contract uploaden voor een lid (alleen kotbaas)
kotgroepenRoutes.post(
  '/:id/contracts/:memberId',
  requireAuth,
  contractUpload.single('file'),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id: kotgroupId, memberId } = req.params as { id: string; memberId: string };

      if (!(await isKotbaas(userId, kotgroupId))) {
        res.status(403).json({ error: 'Alleen de kotbaas kan contracten uploaden.' });
        return;
      }

      if (!(await isMember(memberId, kotgroupId))) {
        res.status(404).json({ error: 'Dit lid hoort niet bij deze kotgroep.' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Geen bestand meegestuurd.' });
        return;
      }

      const path = `${kotgroupId}/${memberId}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('contracts')
        .upload(path, req.file.buffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        res.status(500).json({ error: uploadError.message });
        return;
      }

      const { data: urlData } = supabaseAdmin.storage.from('contracts').getPublicUrl(path);
      res.status(201).json({ url: urlData.publicUrl, member_id: memberId });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
    }
  },
);

// alle contracten van een kotgroep ophalen (alleen kotbaas)
kotgroepenRoutes.get('/:id/contracts', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.params['id'];

    if (!(await isKotbaas(userId, kotgroupId))) {
      res.status(403).json({ error: 'Alleen de kotbaas kan alle contracten bekijken.' });
      return;
    }

    const { data: files, error } = await supabaseAdmin.storage
      .from('contracts')
      .list(kotgroupId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const contracts = (files ?? []).map((file) => {
      const memberId = file.name.replace('.pdf', '');
      const { data: urlData } = supabaseAdmin.storage
        .from('contracts')
        .getPublicUrl(`${kotgroupId}/${file.name}`);
      return { member_id: memberId, url: urlData.publicUrl };
    });

    res.json(contracts);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// contract van een specifiek lid ophalen (lid zelf of kotbaas)
kotgroepenRoutes.get('/:id/contracts/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id: kotgroupId, memberId } = req.params as { id: string; memberId: string };

    // lid mag alleen eigen contract bekijken, kotbaas mag alles
    const userIsMember = await isMember(userId, kotgroupId);
    if (!userIsMember) {
      res.status(403).json({ error: 'Geen toegang tot deze kotgroep.' });
      return;
    }

    const userIsKotbaas = await isKotbaas(userId, kotgroupId);
    if (!userIsKotbaas && userId !== memberId) {
      res.status(403).json({ error: 'Je kunt alleen je eigen contract bekijken.' });
      return;
    }

    const path = `${kotgroupId}/${memberId}.pdf`;

    // check of het bestand bestaat
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('contracts')
      .list(kotgroupId, { search: `${memberId}.pdf` });

    if (listError) {
      res.status(500).json({ error: listError.message });
      return;
    }

    const exists = (files ?? []).some((f) => f.name === `${memberId}.pdf`);
    if (!exists) {
      res.status(404).json({ error: 'Geen contract gevonden.' });
      return;
    }

    const { data: urlData } = supabaseAdmin.storage.from('contracts').getPublicUrl(path);
    res.json({ url: urlData.publicUrl, member_id: memberId });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// contract verwijderen (alleen kotbaas)
kotgroepenRoutes.delete('/:id/contracts/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id: kotgroupId, memberId } = req.params as { id: string; memberId: string };

    if (!(await isKotbaas(userId, kotgroupId))) {
      res.status(403).json({ error: 'Alleen de kotbaas kan contracten verwijderen.' });
      return;
    }

    const path = `${kotgroupId}/${memberId}.pdf`;

    const { error } = await supabaseAdmin.storage.from('contracts').remove([path]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// uitnodigingslink genereren (alleen de kotbaas die de groep aangemaakt heeft)
kotgroepenRoutes.post('/:id/invites', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.params['id'];

    const { data: group, error: groupError } = await supabaseAdmin
      .from('kotgroups')
      .select('id, created_by')
      .eq('id', kotgroupId)
      .single();

    if (groupError || !group) {
      res.status(404).json({ error: 'Kotgroep niet gevonden.' });
      return;
    }
    if (group.created_by !== userId) {
      res.status(403).json({ error: 'Alleen de kotbaas kan een uitnodiging aanmaken.' });
      return;
    }

    const token = randomUUID().replace(/-/g, '');

    const { data: invite, error: insertError } = await supabaseAdmin
      .from('kotgroup_invites')
      .insert({
        kotgroup_id: group.id,
        token,
        created_by: userId,
      })
      .select('token')
      .single();

    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    res.status(201).json({ token: invite.token });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// kotgroep verwijderen (alleen kotbaas)
kotgroepenRoutes.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.params['id'];

    if (!(await isKotbaas(userId, kotgroupId))) {
      res.status(403).json({ error: 'Alleen de kotbaas kan de groep verwijderen.' });
      return;
    }

    // verwijder alle contracten eerst
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('contracts')
      .list(kotgroupId);

    if (listError) {
      res.status(500).json({ error: listError.message });
      return;
    }

    if ((files ?? []).length > 0) {
      const filePaths = (files ?? []).map((f) => `${kotgroupId}/${f.name}`);
      const { error: deleteFilesError } = await supabaseAdmin.storage
        .from('contracts')
        .remove(filePaths);

      if (deleteFilesError) {
        res.status(500).json({ error: deleteFilesError.message });
        return;
      }
    }

    // verwijder alle leden uit de groep
    const { error: deleteMembersError } = await supabaseAdmin
      .from('kotgroup_members')
      .delete()
      .eq('kotgroup_id', kotgroupId);

    if (deleteMembersError) {
      res.status(500).json({ error: deleteMembersError.message });
      return;
    }

    // verwijder alle uitnodigingen
    const { error: deleteInvitesError } = await supabaseAdmin
      .from('kotgroup_invites')
      .delete()
      .eq('kotgroup_id', kotgroupId);

    if (deleteInvitesError) {
      res.status(500).json({ error: deleteInvitesError.message });
      return;
    }

    // verwijder de kotgroep zelf
    const { error: deleteGroupError } = await supabaseAdmin
      .from('kotgroups')
      .delete()
      .eq('id', kotgroupId);

    if (deleteGroupError) {
      res.status(500).json({ error: deleteGroupError.message });
      return;
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
