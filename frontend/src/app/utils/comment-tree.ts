export interface CommentNode {
  id: string;
  parent_comment_id: string | null;
  replies?: CommentNode[];
}

export function buildCommentTree<T extends CommentNode>(flat: T[]): T[] {
  const map = new Map(flat.map((c) => [c.id, { ...c, replies: [] as T[] }]));
  const roots: T[] = [];
  for (const c of map.values()) {
    if (c.parent_comment_id) {
      const parent = map.get(c.parent_comment_id);
      if (parent) (parent.replies as T[]).push(c);
      else roots.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

export function flattenCommentTree<T extends CommentNode>(
  nodes: T[],
  depth = 0,
): (T & { depth: number })[] {
  return nodes.flatMap((c) => [
    { ...c, depth },
    ...flattenCommentTree((c.replies as T[]) ?? [], depth + 1),
  ]);
}
