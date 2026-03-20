import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Post } from '../../models/post.interface';
import { environment } from '../../../environments/environment';
import { PageHeader } from '../../components/page-header/page-header';
import { PostCard } from '../../components/post-card/post-card';
import { Modal } from '../../components/modal/modal';
import { Alert } from '../../components/alert/alert';
import { PageState } from '../../components/page-state/page-state';
import { RichTextEditor } from '../../components/rich-text-editor/rich-text-editor';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [FormsModule, PageHeader, PostCard, Modal, Alert, PageState, RichTextEditor],
  templateUrl: './posts.html',
  styleUrl: './posts.scss',
})
export class Posts implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly kotgroupId = signal<string | null>(null);
  readonly posts = signal<Post[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly backLink = computed(() =>
    this.kotgroupId() ? `/kotgroepen/${this.kotgroupId()}/kotinfo` : '/kotgroepen',
  );

  // 3-dot menu per post (gedeeld zodat maar één tegelijk open kan staan)
  readonly openMenuPostId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuPostId.set(null);
  }

  // create/edit modal state
  readonly showCreateModal = signal(false);
  readonly editingPost = signal<Post | null>(null);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  titleInput = '';
  contentInput = '';
  imageFile: File | null = null;
  imagePreview: string | null = null;
  readonly hasPoll = signal(false);
  pollOptions: string[] = ['', ''];

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
    this.editingPost.set(null);
    this.createError.set(null);
    this.titleInput = '';
    this.contentInput = '';
    this.imageFile = null;
    this.imagePreview = null;
    this.hasPoll.set(false);
    this.pollOptions = ['', ''];
    this.showCreateModal.set(true);
  }

  openEditModal(post: Post): void {
    this.editingPost.set(post);
    this.titleInput = post.title ?? '';
    this.contentInput = post.content ?? '';
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.editingPost.set(null);
  }

  toggleMenu(postId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuPostId.update((current) => (current === postId ? null : postId));
  }

  onPostMenuAction(index: number, postId: string): void {
    if (index === 0) {
      const post = this.posts().find((p) => p.id === postId);
      if (post) this.openEditModal(post);
    }
    if (index === 1) this.deletePost(postId);
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

    this.creating.set(true);
    this.createError.set(null);

    const editing = this.editingPost();

    try {
      if (editing) {
        const updated = await firstValueFrom(
          this.http.patch<Post>(`${environment.apiUrl}/posts/${editing.id}`, {
            title: title || null,
            content: rawText ? this.contentInput : null,
          }),
        );
        this.posts.update((posts) =>
          posts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
        );
        this.closeCreateModal();
        return;
      }

      const validOptions = this.hasPoll() ? this.pollOptions.map((o) => o.trim()).filter(Boolean) : [];
      if (this.hasPoll() && validOptions.length < 2) {
        this.createError.set('Een poll heeft minstens 2 opties nodig.');
        this.creating.set(false);
        return;
      }

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
      this.createError.set(e.error?.error ?? (editing ? 'Post bewerken mislukt.' : 'Post aanmaken mislukt.'));
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
}
