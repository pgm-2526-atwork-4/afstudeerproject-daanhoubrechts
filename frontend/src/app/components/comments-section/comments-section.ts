import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FlatComment } from '../../models/post.interface';
import { Alert } from '../alert/alert';
import { PostMenu } from '../post-menu/post-menu';
import { UserAvatar } from '../user-avatar/user-avatar';

export interface ReplyTarget {
  postId: string;
  commentId: string | null;
  authorName: string;
}

export interface SubmitCommentEvent {
  postId: string;
  content: string;
  parentCommentId: string | null;
}

export interface DeleteCommentEvent {
  postId: string;
  commentId: string;
}

@Component({
  selector: 'app-comments-section',
  imports: [FormsModule, Alert, PostMenu, UserAvatar],
  templateUrl: './comments-section.html',
  styleUrl: './comments-section.scss',
})
export class CommentsSection {
  readonly postId = input.required<string>();
  readonly comments = input<FlatComment[]>([]);
  readonly loading = input(false);
  readonly openMenuCommentId = input<string | null>(null);
  readonly replyingTo = input<ReplyTarget | null>(null);
  readonly submittingComment = input(false);
  readonly commentError = input<string | null>(null);
  readonly currentUserId = input<string | null>(null);

  readonly toggleMenu = output<{ commentId: string; event: MouseEvent }>();
  readonly deleteComment = output<DeleteCommentEvent>();
  readonly startReply = output<ReplyTarget>();
  readonly cancelReply = output<void>();
  readonly submitComment = output<SubmitCommentEvent>();

  // lokaal bijhouden zodat het niet in de parent hoeft te staan
  replyInput = '';

  onToggleMenu(commentId: string, event: MouseEvent): void {
    this.toggleMenu.emit({ commentId, event });
  }

  onStartReply(commentId: string | null, authorName: string): void {
    this.replyInput = '';
    this.startReply.emit({ postId: this.postId(), commentId, authorName });
  }

  onCancelReply(): void {
    this.replyInput = '';
    this.cancelReply.emit();
  }

  onSubmit(parentCommentId: string | null): void {
    const content = this.replyInput.trim();
    if (!content) return;
    this.submitComment.emit({ postId: this.postId(), content, parentCommentId });
    this.replyInput = '';
  }

  getCommentIndent(depth: number): string {
    return `${Math.min(depth * 1.5, 5)}rem`;
  }

  timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Zonet';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min geleden`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} uur geleden`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} dagen geleden`;
    return date.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
