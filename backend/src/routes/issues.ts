import { Router } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Alleen afbeeldingen zijn toegestaan."));
  },
});

export const issuesRoutes = Router();

async function isMember(userId: string, kotgroupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("kotgroup_members")
    .select("user_id")
    .eq("user_id", userId)
    .eq("kotgroup_id", kotgroupId)
    .maybeSingle();
  return !!data;
}

async function isKotbaas(userId: string, kotgroupId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("kotgroups")
    .select("created_by")
    .eq("id", kotgroupId)
    .single();
  return data?.created_by === userId;
}

// GET /api/issues?kotgroupId=... - issues ophalen voor een kotgroep
issuesRoutes.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const kotgroupId = req.query["kotgroupId"] as string;

  if (!kotgroupId) {
    res.status(400).json({ error: "kotgroupId is verplicht." });
    return;
  }

  if (!(await isMember(userId, kotgroupId))) {
    res.status(403).json({ error: "Geen toegang." });
    return;
  }

  const kotbaas = await isKotbaas(userId, kotgroupId);

  try {
    // visibility filter op basis van rol
    let query = supabaseAdmin
      .from("issues")
      .select("*")
      .eq("kotgroup_id", kotgroupId)
      .order("created_at", { ascending: false });

    if (kotbaas) {
      query = query.or(
        `visibility.in.(everyone,kotbaas_only),author_id.eq.${userId}`,
      );
    } else {
      query = query.or(
        `visibility.in.(everyone,kotgenoten_only),author_id.eq.${userId}`,
      );
    }

    const { data: issues, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!issues?.length) {
      res.json([]);
      return;
    }

    const issueIds = issues.map((i) => i.id);
    const authorIds = [...new Set(issues.map((i) => i.author_id))];

    const { data: authors } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", authorIds);
    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

    const { data: imageRows } = await supabaseAdmin
      .from("issue_images")
      .select("id, issue_id, image_url")
      .in("issue_id", issueIds);

    const { data: commentRows } = await supabaseAdmin
      .from("issue_comments")
      .select("issue_id")
      .in("issue_id", issueIds);

    const imagesByIssue = new Map<
      string,
      { id: string; issue_id: string; image_url: string }[]
    >();
    for (const img of imageRows ?? []) {
      if (!imagesByIssue.has(img.issue_id)) imagesByIssue.set(img.issue_id, []);
      imagesByIssue.get(img.issue_id)!.push(img);
    }

    const commentCountByIssue = new Map<string, number>();
    for (const c of commentRows ?? []) {
      commentCountByIssue.set(
        c.issue_id,
        (commentCountByIssue.get(c.issue_id) ?? 0) + 1,
      );
    }

    const result = issues.map((issue) => ({
      ...issue,
      author: authorMap.get(issue.author_id) ?? null,
      images: imagesByIssue.get(issue.id) ?? [],
      comment_count: commentCountByIssue.get(issue.id) ?? 0,
    }));

    res.json(result);
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/issues - nieuwe issue aanmaken
issuesRoutes.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { kotgroup_id, title, content, status, priority, visibility } =
    req.body as {
      kotgroup_id: string;
      title: string;
      content?: string;
      status?: string;
      priority?: string;
      visibility?: string;
    };

  if (!kotgroup_id) {
    res.status(400).json({ error: "kotgroup_id is verplicht." });
    return;
  }
  if (!title?.trim()) {
    res.status(400).json({ error: "Titel is verplicht." });
    return;
  }
  if (!(await isMember(userId, kotgroup_id))) {
    res.status(403).json({ error: "Geen toegang." });
    return;
  }

  try {
    const { data: issue, error } = await supabaseAdmin
      .from("issues")
      .insert({
        kotgroup_id,
        author_id: userId,
        title: title.trim(),
        content: content ?? null,
        status: status ?? "open",
        priority: priority ?? "medium",
        visibility: visibility ?? "everyone",
      })
      .select("*")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: author } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", userId)
      .single();

    res
      .status(201)
      .json({ ...issue, author: author ?? null, images: [], comment_count: 0 });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// PATCH /api/issues/:id - issue aanpassen (auteur of kotbaas)
issuesRoutes.patch("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const { data: issue, error: fetchError } = await supabaseAdmin
      .from("issues")
      .select("author_id, kotgroup_id")
      .eq("id", id)
      .single();

    if (fetchError || !issue) {
      res.status(404).json({ error: "Issue niet gevonden." });
      return;
    }

    const author = issue.author_id === userId;
    const kotb = !author && (await isKotbaas(userId, issue.kotgroup_id));
    if (!author && !kotb) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { title, content, status, priority, visibility } = req.body as {
      title?: string;
      content?: string;
      status?: string;
      priority?: string;
      visibility?: string;
    };

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates["title"] = title.trim();
    if (content !== undefined) updates["content"] = content;
    if (status !== undefined) updates["status"] = status;
    if (priority !== undefined) updates["priority"] = priority;
    if (visibility !== undefined) updates["visibility"] = visibility;

    const { data: updated, error } = await supabaseAdmin
      .from("issues")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(updated);
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// DELETE /api/issues/:id - issue verwijderen (auteur of kotbaas)
issuesRoutes.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const { data: issue, error: fetchError } = await supabaseAdmin
      .from("issues")
      .select("author_id, kotgroup_id")
      .eq("id", id)
      .single();

    if (fetchError || !issue) {
      res.status(404).json({ error: "Issue niet gevonden." });
      return;
    }

    const author = issue.author_id === userId;
    const kotb = !author && (await isKotbaas(userId, issue.kotgroup_id));
    if (!author && !kotb) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    // storage_path ophalen voor verwijdering uit bucket
    const { data: images } = await supabaseAdmin
      .from("issue_images")
      .select("storage_path")
      .eq("issue_id", id);

    const paths = (images ?? [])
      .map((img) => img.storage_path)
      .filter(Boolean) as string[];
    if (paths.length) {
      await supabaseAdmin.storage.from("issue-images").remove(paths);
    }

    const { error } = await supabaseAdmin.from("issues").delete().eq("id", id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/issues/:id/images - afbeelding uploaden (alleen auteur)
issuesRoutes.post(
  "/:id/images",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    const userId = req.user!.id;
    const { id: issueId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: "Geen bestand meegestuurd." });
      return;
    }

    try {
      const { data: issue, error: fetchError } = await supabaseAdmin
        .from("issues")
        .select("author_id")
        .eq("id", issueId)
        .single();

      if (fetchError || !issue) {
        res.status(404).json({ error: "Issue niet gevonden." });
        return;
      }
      if (issue.author_id !== userId) {
        res.status(403).json({ error: "Geen toegang." });
        return;
      }

      const ext = req.file.originalname.split(".").pop() ?? "jpg";
      const storagePath = `${userId}/${issueId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("issue-images")
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        res.status(500).json({ error: uploadError.message });
        return;
      }

      const { data: urlData } = supabaseAdmin.storage
        .from("issue-images")
        .getPublicUrl(storagePath);

      const { data: imageRow, error: insertError } = await supabaseAdmin
        .from("issue_images")
        .insert({
          issue_id: issueId,
          image_url: urlData.publicUrl,
          storage_path: storagePath,
        })
        .select("id, issue_id, image_url")
        .single();

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      res.status(201).json(imageRow);
    } catch (e) {
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  },
);

// DELETE /api/issues/:id/images/:imageId - afbeelding verwijderen (auteur of kotbaas)
issuesRoutes.delete("/:id/images/:imageId", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id: issueId, imageId } = req.params;

  try {
    const { data: issue } = await supabaseAdmin
      .from("issues")
      .select("author_id, kotgroup_id")
      .eq("id", issueId)
      .single();

    if (!issue) {
      res.status(404).json({ error: "Issue niet gevonden." });
      return;
    }

    const author = issue.author_id === userId;
    const kotb = !author && (await isKotbaas(userId, issue.kotgroup_id));
    if (!author && !kotb) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { data: img } = await supabaseAdmin
      .from("issue_images")
      .select("storage_path")
      .eq("id", imageId)
      .eq("issue_id", issueId)
      .single();

    if (!img) {
      res.status(404).json({ error: "Afbeelding niet gevonden." });
      return;
    }

    if (img.storage_path) {
      await supabaseAdmin.storage
        .from("issue-images")
        .remove([img.storage_path]);
    }

    const { error } = await supabaseAdmin
      .from("issue_images")
      .delete()
      .eq("id", imageId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// GET /api/issues/:id/comments - comments ophalen
issuesRoutes.get("/:id/comments", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id: issueId } = req.params;

  try {
    const { data: issue } = await supabaseAdmin
      .from("issues")
      .select("kotgroup_id")
      .eq("id", issueId)
      .single();

    if (!issue) {
      res.status(404).json({ error: "Issue niet gevonden." });
      return;
    }
    if (!(await isMember(userId, issue.kotgroup_id))) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { data: comments, error } = await supabaseAdmin
      .from("issue_comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
    const { data: authors } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", authorIds)
      : { data: [] };

    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));
    const result = (comments ?? []).map((c) => ({
      ...c,
      author: authorMap.get(c.author_id) ?? null,
    }));

    res.json(result);
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/issues/:id/comments - comment aanmaken
issuesRoutes.post("/:id/comments", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { id: issueId } = req.params;
  const { content, parent_comment_id } = req.body as {
    content: string;
    parent_comment_id?: string;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "Inhoud is verplicht." });
    return;
  }

  try {
    const { data: issue } = await supabaseAdmin
      .from("issues")
      .select("kotgroup_id")
      .eq("id", issueId)
      .single();

    if (!issue) {
      res.status(404).json({ error: "Issue niet gevonden." });
      return;
    }
    if (!(await isMember(userId, issue.kotgroup_id))) {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }

    const { data: comment, error } = await supabaseAdmin
      .from("issue_comments")
      .insert({
        issue_id: issueId,
        author_id: userId,
        content: content.trim(),
        parent_comment_id: parent_comment_id ?? null,
      })
      .select("*")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: author } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", userId)
      .single();

    res.status(201).json({ ...comment, author: author ?? null });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// DELETE /api/issues/:id/comments/:commentId - comment verwijderen (auteur van comment of kotbaas)
issuesRoutes.delete(
  "/:id/comments/:commentId",
  requireAuth,
  async (req, res) => {
    const userId = req.user!.id;
    const { id: issueId, commentId } = req.params;

    try {
      const { data: comment } = await supabaseAdmin
        .from("issue_comments")
        .select("author_id, issue_id")
        .eq("id", commentId)
        .eq("issue_id", issueId)
        .single();

      if (!comment) {
        res.status(404).json({ error: "Reactie niet gevonden." });
        return;
      }

      const isAuthor = comment.author_id === userId;
      let kotb = false;
      if (!isAuthor) {
        const { data: issue } = await supabaseAdmin
          .from("issues")
          .select("kotgroup_id")
          .eq("id", issueId)
          .single();
        if (issue) kotb = await isKotbaas(userId, issue.kotgroup_id);
      }

      if (!isAuthor && !kotb) {
        res.status(403).json({ error: "Geen toegang." });
        return;
      }

      const { error } = await supabaseAdmin
        .from("issue_comments")
        .delete()
        .eq("id", commentId);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(204).send();
    } catch (e) {
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  },
);
