import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FlatComment } from '../../models/post.interface';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
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
  imports: [FormsModule, TimeAgoPipe, Alert, PostMenu, UserAvatar],
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

}
