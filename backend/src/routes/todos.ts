import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const todosRoutes = Router();

// todos ophalen voor een kotgroep
todosRoutes.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const kotgroupId = req.query['kotgroupId'] as string | undefined;

    if (!kotgroupId) {
      res.status(400).json({ error: 'kotgroupId is verplicht.' });
      return;
    }

    // lidmaatschap checken
    const { data: membership } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', kotgroupId)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({ error: 'Geen toegang tot deze kotgroep.' });
      return;
    }

    const { data: todos, error } = await supabaseAdmin
      .from('todos')
      .select('id, kotgroup_id, title, description, status, priority, created_by, created_at, updated_at')
      .eq('kotgroup_id', kotgroupId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!todos || todos.length === 0) {
      res.json([]);
      return;
    }

    // assignees per todo ophalen
    const todoIds = todos.map((t) => t.id);

    const { data: assigneeRows, error: assigneeError } = await supabaseAdmin
      .from('todo_assignees')
      .select('todo_id, user_id')
      .in('todo_id', todoIds);

    if (assigneeError) {
      res.status(500).json({ error: assigneeError.message });
      return;
    }

    const allUserIds = [...new Set((assigneeRows ?? []).map((a) => a.user_id))];
    let profileMap: Record<string, { id: string; first_name: string; last_name: string; avatar_url: string | null }> = {};

    if (allUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', allUserIds);

      for (const p of profiles ?? []) {
        profileMap[p.id] = p;
      }
    }

    // assignees koppelen aan todos
    const todosWithAssignees = todos.map((todo) => {
      const assignees = (assigneeRows ?? [])
        .filter((a) => a.todo_id === todo.id)
        .map((a) => profileMap[a.user_id])
        .filter(Boolean);
      return { ...todo, assignees };
    });

    res.json(todosWithAssignees);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// nieuwe todo aanmaken
todosRoutes.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { kotgroup_id, title, description, status, priority, assignee_ids } = req.body as {
      kotgroup_id?: string;
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assignee_ids?: string[];
    };

    if (!kotgroup_id || !title?.trim()) {
      res.status(400).json({ error: 'kotgroup_id en title zijn verplicht.' });
      return;
    }

    const { data: membership } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', kotgroup_id)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({ error: 'Geen toegang tot deze kotgroep.' });
      return;
    }

    const { data: todo, error } = await supabaseAdmin
      .from('todos')
      .insert({
        kotgroup_id,
        title: title.trim(),
        description: description || null,
        status: status ?? 'todo',
        priority: priority ?? 'normaal',
        created_by: userId,
      })
      .select('id, kotgroup_id, title, description, status, priority, created_by, created_at, updated_at')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // assignees toevoegen
    if (assignee_ids && assignee_ids.length > 0) {
      const rows = assignee_ids.map((uid) => ({ todo_id: todo.id, user_id: uid }));
      await supabaseAdmin.from('todo_assignees').insert(rows);
    }

    // assignees ophalen voor response
    const { data: assigneeRows } = await supabaseAdmin
      .from('todo_assignees')
      .select('user_id')
      .eq('todo_id', todo.id);

    const userIds = (assigneeRows ?? []).map((a) => a.user_id);
    let assignees: { id: string; first_name: string; last_name: string; avatar_url: string | null }[] = [];

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
      assignees = profiles ?? [];
    }

    res.status(201).json({ ...todo, assignees });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// todo updaten (lid van de kotgroep)
todosRoutes.patch('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const todoId = req.params['id'];

    const { data: todo, error: todoError } = await supabaseAdmin
      .from('todos')
      .select('id, kotgroup_id, created_by')
      .eq('id', todoId)
      .single();

    if (todoError || !todo) {
      res.status(404).json({ error: 'Todo niet gevonden.' });
      return;
    }

    // ieder lid mag updaten
    const { data: membership } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', todo.kotgroup_id)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({ error: 'Geen toegang.' });
      return;
    }

    const { title, description, status, priority, assignee_ids } = req.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assignee_ids?: string[];
    };

    const update: Record<string, string | null> = {};
    if (title !== undefined) update['title'] = title.trim();
    if (description !== undefined) update['description'] = description || null;
    if (status !== undefined) update['status'] = status;
    if (priority !== undefined) update['priority'] = priority;

    let updated = todo as Record<string, unknown>;

    if (Object.keys(update).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('todos')
        .update(update)
        .eq('id', todoId)
        .select('id, kotgroup_id, title, description, status, priority, created_by, created_at, updated_at')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      updated = data;
    }

    // assignees vervangen als meegegeven
    if (assignee_ids !== undefined) {
      await supabaseAdmin.from('todo_assignees').delete().eq('todo_id', todoId);
      if (assignee_ids.length > 0) {
        const rows = assignee_ids.map((uid) => ({ todo_id: todoId, user_id: uid }));
        await supabaseAdmin.from('todo_assignees').insert(rows);
      }
    }

    // actuele assignees ophalen
    const { data: assigneeRows } = await supabaseAdmin
      .from('todo_assignees')
      .select('user_id')
      .eq('todo_id', todoId);

    const userIds = (assigneeRows ?? []).map((a) => a.user_id);
    let assignees: { id: string; first_name: string; last_name: string; avatar_url: string | null }[] = [];

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
      assignees = profiles ?? [];
    }

    res.json({ ...updated, assignees });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// todo verwijderen (aanmaker of kotbaas)
todosRoutes.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const todoId = req.params['id'];

    const { data: todo, error: todoError } = await supabaseAdmin
      .from('todos')
      .select('id, kotgroup_id, created_by')
      .eq('id', todoId)
      .single();

    if (todoError || !todo) {
      res.status(404).json({ error: 'Todo niet gevonden.' });
      return;
    }

    // aanmaker mag altijd, overige leden ook (kotgroep is gezamenlijk)
    const { data: membership } = await supabaseAdmin
      .from('kotgroup_members')
      .select('kotgroup_id')
      .eq('user_id', userId)
      .eq('kotgroup_id', todo.kotgroup_id)
      .maybeSingle();

    if (!membership) {
      res.status(403).json({ error: 'Geen toegang.' });
      return;
    }

    const { error } = await supabaseAdmin.from('todos').delete().eq('id', todoId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
