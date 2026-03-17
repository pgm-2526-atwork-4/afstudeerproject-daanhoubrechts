export interface PostAuthor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface PollOption {
  id: string;
  post_id: string;
  text: string;
  vote_count: number;
}

export interface Post {
  id: string;
  kotgroup_id: string;
  author_id: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  author: PostAuthor | null;
  poll_options: PollOption[];
  user_vote: string | null;
  comment_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: PostAuthor | null;
  replies?: Comment[];
}

export interface FlatComment extends Comment {
  depth: number;
}
