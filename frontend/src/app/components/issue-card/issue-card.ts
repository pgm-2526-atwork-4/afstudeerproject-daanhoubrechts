import { Component, input, output, signal, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Issue, IssueComment, FlatIssueComment, IssueStatus } from '../../models/issue.interface';
import { environment } from '../../../environments/environment';
import { IssueStatusBadge } from '../issue-status-badge/issue-status-badge';
import { PostMenu } from '../post-menu/post-menu';
import { UserAvatar } from '../user-avatar/user-avatar';
import { Alert } from '../alert/alert';

// comment boom opbouwen vanuit flat array
function buildTree(flat: IssueComment[]): IssueComment[] {
  const map = new Map(flat.map((c) => [c.id, { ...c, replies: [] as IssueComment[] }]));
  const roots: IssueComment[] = [];
  for (const c of map.values()) {
    if (c.parent_comment_id) {
      const parent = map.get(c.parent_comment_id);
      if (parent) parent.replies!.push(c);
      else roots.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

function flattenTree(nodes: IssueComment[], depth = 0): FlatIssueComment[] {
  return nodes.flatMap((c) => [{ ...c, depth }, ...flattenTree(c.replies ?? [], depth + 1)]);
}

@Component({
  selector: 'app-issue-card',
  standalone: true,
  imports: [FormsModule, IssueStatusBadge, PostMenu, UserAvatar, Alert],
  templateUrl: './issue-card.html',
  styleUrl: './issue-card.scss',
})
export class IssueCard {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  readonly issue = input.required<Issue>();
  readonly currentUserId = input<string | null>(null);
  readonly isKotbaas = input(false);
  readonly openMenuIssueId = input<string | null>(null);

  readonly deleted = output<string>();
  readonly editRequested = output<Issue>();
  readonly menuTrigger = output<{ issueId: string; event: MouseEvent }>();

  // comments state
  readonly showComments = signal(false);
  readonly comments = signal<FlatIssueComment[]>([]);
  readonly commentsLoading = signal(false);
  readonly commentsLoaded = signal(false);
  readonly openMenuCommentId = signal<string | null>(null);
  readonly replyingTo = signal<string | null>(null);
  readonly submittingComment = signal(false);
  readonly commentError = signal<string | null>(null);
  readonly patchingStatus = signal(false);

  newCommentText = '';

  readonly canEdit = computed(
    () => this.issue().author_id === this.currentUserId() || this.isKotbaas(),
  );

  safeContent(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
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

  toggleComments(): void {
    this.showComments.update((v) => !v);
    if (this.showComments() && !this.commentsLoaded()) {
      this.loadComments();
    }
  }

  loadComments(): void {
    this.commentsLoading.set(true);
    this.http
      .get<IssueComment[]>(`${environment.apiUrl}/issues/${this.issue().id}/comments`)
      .subscribe({
        next: (data) => {
          this.comments.set(flattenTree(buildTree(data)));
          this.commentsLoading.set(false);
          this.commentsLoaded.set(true);
        },
        error: () => {
          this.commentsLoading.set(false);
        },
      });
  }

  async patchStatus(status: IssueStatus): Promise<void> {
    this.patchingStatus.set(true);
    try {
      const updated = await firstValueFrom(
        this.http.patch<Issue>(`${environment.apiUrl}/issues/${this.issue().id}`, { status }),
      );
      // parent laten weten dat de issue geüpdatet is
      this.editRequested.emit({ ...this.issue(), ...updated });
    } catch {
      // stil falen
    } finally {
      this.patchingStatus.set(false);
    }
  }

  async onSubmitComment(parentCommentId: string | null): Promise<void> {
    const content = this.newCommentText.trim();
    if (!content) return;

    this.submittingComment.set(true);
    this.commentError.set(null);

    try {
      const comment = await firstValueFrom(
        this.http.post<IssueComment>(`${environment.apiUrl}/issues/${this.issue().id}/comments`, {
          content,
          parent_comment_id: parentCommentId,
        }),
      );

      const current = [...this.comments()];
      if (parentCommentId) {
        const parentIdx = current.findIndex((c) => c.id === parentCommentId);
        const parentDepth = parentIdx >= 0 ? current[parentIdx].depth : 0;
        const flat: FlatIssueComment = { ...comment, depth: parentDepth + 1, replies: [] };
        let insertIdx = parentIdx + 1;
        while (insertIdx < current.length && current[insertIdx].depth > parentDepth) insertIdx++;
        current.splice(insertIdx, 0, flat);
      } else {
        current.push({ ...comment, depth: 0, replies: [] });
      }

      this.comments.set(current);
      this.newCommentText = '';
      this.replyingTo.set(null);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.commentError.set(e.error?.error ?? 'Reactie plaatsen mislukt.');
    } finally {
      this.submittingComment.set(false);
    }
  }

  async onDeleteComment(commentId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/issues/${this.issue().id}/comments/${commentId}`),
      );
      this.comments.set(this.comments().filter((c) => c.id !== commentId));
    } catch {
      // stil falen
    }
  }

  onMenuAction(index: number): void {
    if (index === 0) this.editRequested.emit(this.issue());
    if (index === 1) this.deleted.emit(this.issue().id);
  }

  onMenuTrigger(event: MouseEvent): void {
    this.menuTrigger.emit({ issueId: this.issue().id, event });
  }

  toggleCommentMenu(commentId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuCommentId.update((current) => (current === commentId ? null : commentId));
  }

  setReplyingTo(commentId: string | null): void {
    this.replyingTo.set(commentId);
    this.commentError.set(null);
    this.newCommentText = '';
  }

  visibilityIcon(visibility: string): string {
    if (visibility === 'kotbaas_only') return 'slot';
    if (visibility === 'kotgenoten_only') return 'personen';
    return 'globe';
  }
}
