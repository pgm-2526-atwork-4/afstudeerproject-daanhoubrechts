import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Post, Comment, FlatComment } from '../../models/post.interface';
import { environment } from '../../../environments/environment';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { buildCommentTree, flattenCommentTree } from '../../utils/comment-tree';
import { UserAvatar } from '../user-avatar/user-avatar';
import { PostMenu } from '../post-menu/post-menu';
import { PollBlock } from '../poll-block/poll-block';
import { CommentsSection } from '../comments-section/comments-section';

import type { ReplyTarget, SubmitCommentEvent, DeleteCommentEvent } from '../comments-section/comments-section';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [FormsModule, TimeAgoPipe, UserAvatar, PostMenu, PollBlock, CommentsSection],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  private http = inject(HttpClient);

  readonly post = input.required<Post>();
  readonly currentUserId = input<string | null>(null);
  readonly openMenuPostId = input<string | null>(null);

  readonly menuTrigger = output<{ postId: string; event: MouseEvent }>();
  readonly menuAction = output<{ index: number; postId: string }>();
  readonly voted = output<{ postId: string; optionId: string }>();

  // comments state
  readonly showComments = signal(false);
  readonly comments = signal<FlatComment[]>([]);
  readonly commentsLoading = signal(false);
  readonly commentsLoaded = signal(false);
  readonly openMenuCommentId = signal<string | null>(null);
  readonly replyingTo = signal<ReplyTarget | null>(null);
  readonly submittingComment = signal(false);
  readonly commentError = signal<string | null>(null);

  // lokale commentCount bijhouden zodat de teller direct update
  readonly localCommentCount = signal<number | null>(null);

  get commentCount(): number {
    return this.localCommentCount() ?? this.post().comment_count;
  }

  onMenuTrigger(event: MouseEvent): void {
    this.menuTrigger.emit({ postId: this.post().id, event });
  }

  onMenuAction(index: number): void {
    this.menuAction.emit({ index, postId: this.post().id });
  }

  toggleComments(): void {
    this.showComments.update((v) => !v);
    if (this.showComments() && !this.commentsLoaded()) {
      this.loadComments();
    }
  }

  private loadComments(): void {
    this.commentsLoading.set(true);
    this.http
      .get<Comment[]>(`${environment.apiUrl}/posts/${this.post().id}/comments`)
      .subscribe({
        next: (data) => {
          this.comments.set(flattenCommentTree(buildCommentTree(data)) as FlatComment[]);
          this.commentsLoading.set(false);
          this.commentsLoaded.set(true);
        },
        error: () => {
          this.commentsLoading.set(false);
        },
      });
  }

  onStartReply(target: ReplyTarget): void {
    this.replyingTo.set(target);
    this.commentError.set(null);
  }

  onCancelReply(): void {
    this.replyingTo.set(null);
  }

  toggleCommentMenu(commentId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuCommentId.update((current) => (current === commentId ? null : commentId));
  }

  async onSubmitComment(event: SubmitCommentEvent): Promise<void> {
    const { postId, content, parentCommentId } = event;
    if (!content) return;

    this.submittingComment.set(true);
    this.commentError.set(null);

    try {
      const comment = await firstValueFrom(
        this.http.post<Comment>(`${environment.apiUrl}/posts/${postId}/comments`, {
          content,
          parent_comment_id: parentCommentId,
        }),
      );

      const current = [...this.comments()];
      if (parentCommentId) {
        const parentIdx = current.findIndex((c) => c.id === parentCommentId);
        const parentDepth = parentIdx >= 0 ? current[parentIdx].depth : 0;
        const flat: FlatComment = { ...comment, depth: parentDepth + 1, replies: [] };
        let insertIdx = parentIdx + 1;
        while (insertIdx < current.length && current[insertIdx].depth > parentDepth) insertIdx++;
        current.splice(insertIdx, 0, flat);
      } else {
        current.push({ ...comment, depth: 0, replies: [] });
      }

      this.comments.set(current);
      this.localCommentCount.set(this.commentCount + 1);
      this.replyingTo.set(null);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.commentError.set(e.error?.error ?? 'Reactie plaatsen mislukt.');
    } finally {
      this.submittingComment.set(false);
    }
  }

  async onDeleteComment(event: DeleteCommentEvent): Promise<void> {
    const { postId, commentId } = event;
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/posts/${postId}/comments/${commentId}`),
      );
      this.comments.set(this.comments().filter((c) => c.id !== commentId));
      this.localCommentCount.set(Math.max(0, this.commentCount - 1));
    } catch {
      // stil falen
    }
  }

  renderContent(content: string | null): string {
    return content ?? '';
  }
}
