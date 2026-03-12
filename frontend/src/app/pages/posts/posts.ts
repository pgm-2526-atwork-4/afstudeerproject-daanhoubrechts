import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Post, Comment, FlatComment } from '../../models/post.interface';
import { environment } from '../../../environments/environment';
import { UserAvatar } from '../../components/user-avatar/user-avatar';
import { Modal } from '../../components/modal/modal';
import { Alert } from '../../components/alert/alert';
import { PageState } from '../../components/page-state/page-state';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [RouterLink, FormsModule, UserAvatar, Modal, Alert, PageState],
  templateUrl: './posts.html',
  styleUrl: './posts.scss',
})
export class Posts implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  protected readonly Math = Math;

  readonly kotgroupId = signal<string | null>(null);
  readonly posts = signal<Post[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly backLink = computed(() =>
    this.kotgroupId() ? `/kotgroepen/${this.kotgroupId()}/kotinfo` : '/kotgroepen',
  );

  // 3-dot menus
  readonly openMenuPostId = signal<string | null>(null);
  readonly openMenuCommentId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuPostId.set(null);
    this.openMenuCommentId.set(null);
  }

  // create modal state
  readonly showCreateModal = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  titleInput = '';
  contentInput = '';
  imageFile: File | null = null;
  imagePreview: string | null = null;
  readonly hasPoll = signal(false);
  pollOptions: string[] = ['', ''];

  // comments state
  readonly expandedPosts = signal<Set<string>>(new Set());
  readonly postComments = signal<Map<string, FlatComment[]>>(new Map());
  readonly loadingComments = signal<Set<string>>(new Set());

  // reply state (null commentId = reactie op post zelf)
  readonly replyingTo = signal<{ postId: string; commentId: string | null; authorName: string } | null>(null);
  replyInput = '';
  readonly submittingComment = signal(false);
  readonly commentError = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Kotgroep ID niet gevonden.');
      this.loading.set(false);
      return;
    }
    this.kotgroupId.set(id);
    this.loadPosts(id);
  }

  private loadPosts(kotgroupId: string): void {
    this.http.get<Post[]>(`${environment.apiUrl}/posts?kotgroupId=${kotgroupId}`).subscribe({
      next: (data) => {
        this.posts.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Posts laden mislukt.');
        this.loading.set(false);
      },
    });
  }

  // --- create modal ---

  openCreateModal(): void {
    this.showCreateModal.set(true);
    this.createError.set(null);
    this.titleInput = '';
    this.contentInput = '';
    this.imageFile = null;
    this.imagePreview = null;
    this.hasPoll.set(false);
    this.pollOptions = ['', ''];
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  toggleMenu(postId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuCommentId.set(null);
    this.openMenuPostId.update((current) => (current === postId ? null : postId));
  }

  toggleCommentMenu(commentId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuPostId.set(null);
    this.openMenuCommentId.update((current) => (current === commentId ? null : commentId));
  }

  // vet, cursief of onderlijnd toepassen via execCommand
  // mousedown op de knoppen verhindert dat de editor focus verliest,
  // zodat de selectie bewaard blijft
  applyFormat(command: string, editor: HTMLElement): void {
    editor.focus();
    document.execCommand(command, false, undefined);
    this.contentInput = editor.innerHTML;
  }

  onEditorInput(editor: HTMLElement): void {
    this.contentInput = editor.innerHTML;
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.imageFile = null;
    this.imagePreview = null;
  }

  addPollOption(): void {
    this.pollOptions.push('');
  }

  removePollOption(index: number): void {
    if (this.pollOptions.length > 2) this.pollOptions.splice(index, 1);
  }

  async submitPost(): Promise<void> {
    const kotgroupId = this.kotgroupId();
    if (!kotgroupId) return;

    const title = this.titleInput.trim();
    // HTML tags strippen om te controleren of er echte inhoud is
    const rawText = this.contentInput.replace(/<[^>]*>/g, '').trim();
    if (!title && !rawText) {
      this.createError.set('Voeg minstens een titel of inhoud toe.');
      return;
    }

    const validOptions = this.hasPoll() ? this.pollOptions.map((o) => o.trim()).filter(Boolean) : [];
    if (this.hasPoll() && validOptions.length < 2) {
      this.createError.set('Een poll heeft minstens 2 opties nodig.');
      return;
    }

    this.creating.set(true);
    this.createError.set(null);

    try {
      const post = await firstValueFrom(
        this.http.post<Post>(`${environment.apiUrl}/posts`, {
          kotgroup_id: kotgroupId,
          title: title || undefined,
          content: rawText ? this.contentInput : undefined,
          poll_options: validOptions.length ? validOptions : undefined,
        }),
      );

      if (this.imageFile) {
        const formData = new FormData();
        formData.append('file', this.imageFile);
        const result = await firstValueFrom(
          this.http.post<{ image_url: string }>(`${environment.apiUrl}/posts/${post.id}/image`, formData),
        );
        post.image_url = result.image_url;
      }

      this.posts.update((posts) => [post, ...posts]);
      this.closeCreateModal();
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.createError.set(e.error?.error ?? 'Post aanmaken mislukt.');
    } finally {
      this.creating.set(false);
    }
  }

  async deletePost(postId: string): Promise<void> {
    if (!confirm('Post verwijderen?')) return;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/posts/${postId}`));
      this.posts.update((posts) => posts.filter((p) => p.id !== postId));
    } catch {
      // stil falen
    }
  }

  // --- comments ---

  toggleComments(postId: string): void {
    const current = new Set(this.expandedPosts());
    if (current.has(postId)) {
      current.delete(postId);
      // reply state opruimen
      if (this.replyingTo()?.postId === postId) this.replyingTo.set(null);
    } else {
      current.add(postId);
      if (!this.postComments().has(postId)) this.fetchComments(postId);
    }
    this.expandedPosts.set(current);
  }

  private fetchComments(postId: string): void {
    const loading = new Set(this.loadingComments());
    loading.add(postId);
    this.loadingComments.set(loading);

    this.http.get<Comment[]>(`${environment.apiUrl}/posts/${postId}/comments`).subscribe({
      next: (comments) => {
        const map = new Map(this.postComments());
        map.set(postId, this.flattenTree(this.buildTree(comments)));
        this.postComments.set(map);
        const l = new Set(this.loadingComments());
        l.delete(postId);
        this.loadingComments.set(l);
      },
      error: () => {
        const l = new Set(this.loadingComments());
        l.delete(postId);
        this.loadingComments.set(l);
      },
    });
  }

  private buildTree(comments: Comment[]): Comment[] {
    const map = new Map(comments.map((c) => [c.id, { ...c, replies: [] as Comment[] }]));
    const roots: Comment[] = [];
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

  private flattenTree(comments: Comment[], depth = 0): FlatComment[] {
    return comments.flatMap((c) => [
      { ...c, depth },
      ...this.flattenTree(c.replies ?? [], depth + 1),
    ]);
  }

  startReply(postId: string, commentId: string | null, authorName: string): void {
    this.replyingTo.set({ postId, commentId, authorName });
    this.replyInput = '';
    this.commentError.set(null);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
    this.replyInput = '';
  }

  async submitComment(postId: string): Promise<void> {
    const content = this.replyInput.trim();
    if (!content) return;

    const replyTo = this.replyingTo();
    this.submittingComment.set(true);
    this.commentError.set(null);

    try {
      const comment = await firstValueFrom(
        this.http.post<Comment>(`${environment.apiUrl}/posts/${postId}/comments`, {
          content,
          parent_comment_id: replyTo?.commentId ?? null,
        }),
      );

      const map = new Map(this.postComments());
      const current = [...(map.get(postId) ?? [])];

      if (replyTo?.commentId) {
        // reply direct na zijn parent (en bestaande replies) inlassen
        const parentIdx = current.findIndex((c) => c.id === replyTo.commentId);
        const parentDepth = parentIdx >= 0 ? current[parentIdx].depth : 0;
        const flat: FlatComment = { ...comment, depth: parentDepth + 1, replies: [] };
        let insertIdx = parentIdx + 1;
        while (insertIdx < current.length && current[insertIdx].depth > parentDepth) insertIdx++;
        current.splice(insertIdx, 0, flat);
      } else {
        current.push({ ...comment, depth: 0, replies: [] });
      }

      map.set(postId, current);
      this.postComments.set(map);

      this.posts.update((posts) =>
        posts.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p)),
      );

      this.replyInput = '';
      this.replyingTo.set(null);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.commentError.set(e.error?.error ?? 'Reactie plaatsen mislukt.');
    } finally {
      this.submittingComment.set(false);
    }
  }

  async deleteComment(postId: string, commentId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/posts/${postId}/comments/${commentId}`),
      );
      const map = new Map(this.postComments());
      const current = (map.get(postId) ?? []).filter((c) => c.id !== commentId);
      map.set(postId, current);
      this.postComments.set(map);
      this.posts.update((posts) =>
        posts.map((p) =>
          p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p,
        ),
      );
    } catch {
      // stil falen
    }
  }

  // --- poll ---

  async voteOnPoll(postId: string, optionId: string): Promise<void> {
    const post = this.posts().find((p) => p.id === postId);
    if (!post) return;
    const currentVote = post.user_vote;

    try {
      if (currentVote === optionId) {
        await firstValueFrom(this.http.delete(`${environment.apiUrl}/posts/${postId}/vote`));
        this.posts.update((posts) =>
          posts.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              user_vote: null,
              poll_options: p.poll_options.map((o) =>
                o.id === optionId ? { ...o, vote_count: Math.max(0, o.vote_count - 1) } : o,
              ),
            };
          }),
        );
      } else {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/posts/${postId}/vote`, { option_id: optionId }),
        );
        this.posts.update((posts) =>
          posts.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              user_vote: optionId,
              poll_options: p.poll_options.map((o) => {
                if (o.id === optionId) return { ...o, vote_count: o.vote_count + 1 };
                if (o.id === currentVote) return { ...o, vote_count: Math.max(0, o.vote_count - 1) };
                return o;
              }),
            };
          }),
        );
      }
    } catch {
      // stil falen
    }
  }

  getPollTotal(post: Post): number {
    return post.poll_options.reduce((sum, o) => sum + o.vote_count, 0);
  }

  getPollPercentage(post: Post, optionId: string): number {
    const total = this.getPollTotal(post);
    if (!total) return 0;
    const option = post.poll_options.find((o) => o.id === optionId);
    return Math.round(((option?.vote_count ?? 0) / total) * 100);
  }

  // --- helpers ---

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

  renderContent(content: string | null): string {
    return content ?? '';
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  getCommentIndent(depth: number): string {
    return `${Math.min(depth * 1.5, 5)}rem`;
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }
}
