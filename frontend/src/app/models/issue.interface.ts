import { PostAuthor } from './post.interface';

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type IssueVisibility = 'everyone' | 'kotbaas_only' | 'kotgenoten_only';

export interface IssueImage {
  id: string;
  issue_id: string;
  image_url: string;
}

export interface Issue {
  id: string;
  kotgroup_id: string;
  author_id: string;
  title: string;
  content: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  visibility: IssueVisibility;
  created_at: string;
  updated_at: string;
  author: PostAuthor | null;
  images: IssueImage[];
  comment_count: number;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  parent_comment_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: PostAuthor | null;
  replies?: IssueComment[];
}

export interface FlatIssueComment extends IssueComment {
  depth: number;
}
