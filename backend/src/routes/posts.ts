import { Router } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Alleen afbeeldingen zijn toegestaan.'));
  },
});

export const postsRoutes = Router();

async function isMember(userId: string, kotgroupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('kotgroup_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('kotgroup_id', kotgroupId)
    .maybeSingle();
  return !!data;
}

// GET /api/posts?kotgroupId=... - posts ophalen voor een kotgroep
postsRoutes.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const kotgroupId = req.query['kotgroupId'] as string;

  if (!kotgroupId) {
    res.status(400).json({ error: 'kotgroupId is verplicht.' });
    return;
  }

  if (!(await isMember(userId, kotgroupId))) {
    res.status(403).json({ error: 'Geen toegang.' });
    return;
  }

  try {
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('kotgroup_id', kotgroupId)
      .order('created_at', { ascending: false });

    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!posts?.length) { res.json([]); return; }

    const postIds = posts.map((p) => p.id);
    const authorIds = [...new Set(posts.map((p) => p.author_id))];

    const { data: authors } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', authorIds);
    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

    const { data: pollOptions } = await supabaseAdmin
      .from('poll_options')
      .select('id, post_id, text')
      .in('post_id', postIds);

    const { data: pollVotes } = await supabaseAdmin
      .from('poll_votes')
      .select('option_id, post_id, user_id')
      .in('post_id', postIds);

    const { data: commentRows } = await supabaseAdmin
      .from('comments')
      .select('post_id')
      .in('post_id', postIds);

    // poll data samenstellen
    const optionsByPost = new Map<string, { id: string; post_id: string; text: string }[]>();
    for (const opt of pollOptions ?? []) {
      if (!optionsByPost.has(opt.post_id)) optionsByPost.set(opt.post_id, []);
      optionsByPost.get(opt.post_id)!.push(opt);
    }

    const votesByOption = new Map<string, number>();
    const userVoteByPost = new Map<string, string>();
    for (const vote of pollVotes ?? []) {
      votesByOption.set(vote.option_id, (votesByOption.get(vote.option_id) ?? 0) + 1);
      if (vote.user_id === userId) userVoteByPost.set(vote.post_id, vote.option_id);
    }

    const commentCountByPost = new Map<string, number>();
    for (const c of commentRows ?? []) {
      commentCountByPost.set(c.post_id, (commentCountByPost.get(c.post_id) ?? 0) + 1);
    }

    const result = posts.map((post) => ({
      ...post,
      author: authorMap.get(post.author_id) ?? null,
      poll_options: (optionsByPost.get(post.id) ?? []).map((opt) => ({
        ...opt,
        vote_count: votesByOption.get(opt.id) ?? 0,
      })),
      user_vote: userVoteByPost.get(post.id) ?? null,
      comment_count: commentCountByPost.get(post.id) ?? 0,
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// POST /api/posts - nieuwe post aanmaken
postsRoutes.post('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { kotgroup_id, title, content, poll_options } = req.body as {
    kotgroup_id: string;
    title?: string;
    content?: string;
    poll_options?: string[];
  };

  if (!kotgroup_id) { res.status(400).json({ error: 'kotgroup_id is verplicht.' }); return; }
  if (!(await isMember(userId, kotgroup_id))) { res.status(403).json({ error: 'Geen toegang.' }); return; }

  const trimmedTitle = title?.trim();
  const trimmedContent = content?.trim();
  if (!trimmedTitle && !trimmedContent) {
    res.status(400).json({ error: 'Een post heeft minstens een titel of inhoud nodig.' });
    return;
  }

  try {
    const { data: post, error } = await supabaseAdmin
      .from('posts')
      .insert({ kotgroup_id, author_id: userId, title: trimmedTitle || null, content: trimmedContent || null })
      .select('*')
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    const validOptions = (poll_options ?? []).map((o) => o.trim()).filter(Boolean);
    if (validOptions.length >= 2) {
      await supabaseAdmin
        .from('poll_options')
        .insert(validOptions.map((text) => ({ post_id: post.id, text })));
    }

    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .eq('id', userId)
      .single();

    const { data: createdOptions } = await supabaseAdmin
      .from('poll_options')
      .select('id, post_id, text')
      .eq('post_id', post.id);

    res.status(201).json({
      ...post,
      author: author ?? null,
      poll_options: (createdOptions ?? []).map((o) => ({ ...o, vote_count: 0 })),
      user_vote: null,
      comment_count: 0,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// POST /api/posts/:postId/image - afbeelding uploaden bij een post
postsRoutes.post('/:postId/image', requireAuth, upload.single('file'), async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;

  if (!req.file) { res.status(400).json({ error: 'Geen bestand meegestuurd.' }); return; }

  try {
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (postError || !post) { res.status(404).json({ error: 'Post niet gevonden.' }); return; }
    if (post.author_id !== userId) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const ext = req.file.originalname.split('.').pop() ?? 'jpg';
    const path = `${userId}/${postId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('post-images')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

    const { data: urlData } = supabaseAdmin.storage.from('post-images').getPublicUrl(path);

    const { error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ image_url: urlData.publicUrl })
      .eq('id', postId);

    if (updateError) { res.status(500).json({ error: updateError.message }); return; }

    res.json({ image_url: urlData.publicUrl });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// PATCH /api/posts/:postId - post bewerken (alleen auteur)
postsRoutes.patch('/:postId', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;
  const { title, content } = req.body as { title?: string | null; content?: string | null };

  try {
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (postError || !post) { res.status(404).json({ error: 'Post niet gevonden.' }); return; }
    if (post.author_id !== userId) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const trimmedTitle = title?.trim() ?? null;
    const trimmedContent = content?.trim() ?? null;

    if (!trimmedTitle && !trimmedContent) {
      res.status(400).json({ error: 'Een post heeft minstens een titel of inhoud nodig.' });
      return;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ title: trimmedTitle || null, content: trimmedContent || null })
      .eq('id', postId)
      .select('*')
      .single();

    if (updateError) { res.status(500).json({ error: updateError.message }); return; }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// DELETE /api/posts/:postId - post verwijderen (auteur of kotbaas)
postsRoutes.delete('/:postId', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;

  try {
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('author_id, kotgroup_id')
      .eq('id', postId)
      .single();

    if (postError || !post) { res.status(404).json({ error: 'Post niet gevonden.' }); return; }

    const isAuthor = post.author_id === userId;
    let isKotbaas = false;
    if (!isAuthor) {
      const { data: group } = await supabaseAdmin
        .from('kotgroups')
        .select('created_by')
        .eq('id', post.kotgroup_id)
        .single();
      isKotbaas = group?.created_by === userId;
    }

    if (!isAuthor && !isKotbaas) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const { error } = await supabaseAdmin.from('posts').delete().eq('id', postId);
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// POST /api/posts/:postId/vote - stem plaatsen of wisselen
postsRoutes.post('/:postId/vote', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;
  const { option_id } = req.body as { option_id: string };

  if (!option_id) { res.status(400).json({ error: 'option_id is verplicht.' }); return; }

  try {
    const { error } = await supabaseAdmin
      .from('poll_votes')
      .upsert({ post_id: postId, option_id, user_id: userId }, { onConflict: 'post_id,user_id' });

    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({ option_id });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// DELETE /api/posts/:postId/vote - stem verwijderen
postsRoutes.delete('/:postId/vote', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('poll_votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) { res.status(500).json({ error: error.message }); return; }

    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// GET /api/posts/:postId/comments - comments ophalen
postsRoutes.get('/:postId/comments', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;

  try {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('kotgroup_id')
      .eq('id', postId)
      .single();

    if (!post) { res.status(404).json({ error: 'Post niet gevonden.' }); return; }
    if (!(await isMember(userId, post.kotgroup_id))) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) { res.status(500).json({ error: error.message }); return; }

    const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
    const { data: authors } = authorIds.length
      ? await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', authorIds)
      : { data: [] };

    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));
    const result = (comments ?? []).map((c) => ({ ...c, author: authorMap.get(c.author_id) ?? null }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// POST /api/posts/:postId/comments - comment of reply aanmaken
postsRoutes.post('/:postId/comments', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId } = req.params;
  const { content, parent_comment_id } = req.body as { content: string; parent_comment_id?: string };

  if (!content?.trim()) { res.status(400).json({ error: 'Inhoud is verplicht.' }); return; }

  try {
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('kotgroup_id')
      .eq('id', postId)
      .single();

    if (!post) { res.status(404).json({ error: 'Post niet gevonden.' }); return; }
    if (!(await isMember(userId, post.kotgroup_id))) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({
        post_id: postId,
        author_id: userId,
        content: content.trim(),
        parent_comment_id: parent_comment_id ?? null,
      })
      .select('*')
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }

    const { data: author } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .eq('id', userId)
      .single();

    res.status(201).json({ ...comment, author: author ?? null });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

// DELETE /api/posts/:postId/comments/:commentId - comment verwijderen (auteur of kotbaas)
postsRoutes.delete('/:postId/comments/:commentId', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { postId, commentId } = req.params;

  try {
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('author_id, post_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .single();

    if (!comment) { res.status(404).json({ error: 'Reactie niet gevonden.' }); return; }

    const isAuthor = comment.author_id === userId;
    let isKotbaas = false;
    if (!isAuthor) {
      const { data: post } = await supabaseAdmin
        .from('posts')
        .select('kotgroup_id')
        .eq('id', postId)
        .single();
      if (post) {
        const { data: group } = await supabaseAdmin
          .from('kotgroups')
          .select('created_by')
          .eq('id', post.kotgroup_id)
          .single();
        isKotbaas = group?.created_by === userId;
      }
    }

    if (!isAuthor && !isKotbaas) { res.status(403).json({ error: 'Geen toegang.' }); return; }

    const { error } = await supabaseAdmin.from('comments').delete().eq('id', commentId);
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
