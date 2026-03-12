import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Issue, IssueStatus, IssuePriority, IssueVisibility } from '../../models/issue.interface';
import { environment } from '../../../environments/environment';
import { IssueCard } from '../../components/issue-card/issue-card';
import { Modal } from '../../components/modal/modal';
import { Alert } from '../../components/alert/alert';
import { PageState } from '../../components/page-state/page-state';

@Component({
  selector: 'app-issues',
  standalone: true,
  imports: [RouterLink, FormsModule, IssueCard, Modal, Alert, PageState],
  templateUrl: './issues.html',
  styleUrl: './issues.scss',
})
export class Issues implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly kotgroupId = signal<string | null>(null);
  readonly issues = signal<Issue[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);
  readonly isKotbaas = signal(false);

  readonly backLink = computed(() =>
    this.kotgroupId() ? `/kotgroepen/${this.kotgroupId()}/kotinfo` : '/kotgroepen',
  );

  // modal state
  readonly showModal = signal(false);
  readonly creating = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly editingIssue = signal<Issue | null>(null);

  // form velden
  titleInput = '';
  contentInput = '';
  imageFiles: File[] = [];
  imagePreviews: string[] = [];
  statusInput: IssueStatus = 'open';
  priorityInput: IssuePriority = 'medium';
  visibilityInput: IssueVisibility = 'everyone';

  // open menu tracking
  readonly openMenuIssueId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openMenuIssueId.set(null);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Kotgroep ID niet gevonden.');
      this.loading.set(false);
      return;
    }
    this.kotgroupId.set(id);
    this.loadIssues(id);
    this.checkKotbaas(id);
  }

  private loadIssues(kotgroupId: string): void {
    this.http.get<Issue[]>(`${environment.apiUrl}/issues?kotgroupId=${kotgroupId}`).subscribe({
      next: (data) => {
        this.issues.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Issues laden mislukt.');
        this.loading.set(false);
      },
    });
  }

  private checkKotbaas(kotgroupId: string): void {
    this.http
      .get<{ id: string; created_by: string }>(`${environment.apiUrl}/kotgroepen/${kotgroupId}`)
      .subscribe({
        next: (group) => {
          this.isKotbaas.set(group.created_by === this.currentUserId());
        },
        error: () => {
          // geen kotbaas als ophalen faalt
        },
      });
  }

  openCreateModal(): void {
    this.editingIssue.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(issue: Issue): void {
    this.editingIssue.set(issue);
    this.titleInput = issue.title;
    this.contentInput = issue.content ?? '';
    this.statusInput = issue.status;
    this.priorityInput = issue.priority;
    this.visibilityInput = issue.visibility;
    this.imageFiles = [];
    this.imagePreviews = [];
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  private resetForm(): void {
    this.titleInput = '';
    this.contentInput = '';
    this.imageFiles = [];
    this.imagePreviews = [];
    this.statusInput = 'open';
    this.priorityInput = 'medium';
    this.visibilityInput = 'everyone';
    this.modalError.set(null);
  }

  async submitIssue(): Promise<void> {
    const kotgroupId = this.kotgroupId();
    if (!kotgroupId) return;
    if (!this.titleInput.trim()) {
      this.modalError.set('Titel is verplicht.');
      return;
    }

    this.creating.set(true);
    this.modalError.set(null);

    try {
      const editing = this.editingIssue();
      let issue: Issue;

      if (editing) {
        issue = await firstValueFrom(
          this.http.patch<Issue>(`${environment.apiUrl}/issues/${editing.id}`, {
            title: this.titleInput.trim(),
            content: this.contentInput || null,
            status: this.statusInput,
            priority: this.priorityInput,
            visibility: this.visibilityInput,
          }),
        );
        // bestaande images meegeven (patch geeft enkel het record terug)
        issue = { ...editing, ...issue };
      } else {
        issue = await firstValueFrom(
          this.http.post<Issue>(`${environment.apiUrl}/issues`, {
            kotgroup_id: kotgroupId,
            title: this.titleInput.trim(),
            content: this.contentInput || null,
            status: this.statusInput,
            priority: this.priorityInput,
            visibility: this.visibilityInput,
          }),
        );
      }

      if (this.imageFiles.length) {
        await this.uploadImages(issue.id);
        // herlaad om images mee te krijgen
        const refreshed = await firstValueFrom(
          this.http.get<Issue[]>(`${environment.apiUrl}/issues?kotgroupId=${kotgroupId}`),
        );
        this.issues.set(refreshed);
      } else if (editing) {
        this.issues.update((list) => list.map((i) => (i.id === issue.id ? issue : i)));
      } else {
        this.issues.update((list) => [issue, ...list]);
      }

      this.closeModal();
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.modalError.set(e.error?.error ?? 'Opslaan mislukt.');
    } finally {
      this.creating.set(false);
    }
  }

  private async uploadImages(issueId: string): Promise<void> {
    for (const file of this.imageFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/issues/${issueId}/images`, formData),
        );
      } catch {
        // stil falen per bestand
      }
    }
  }

  async deleteIssue(id: string): Promise<void> {
    if (!confirm('Issue verwijderen?')) return;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/issues/${id}`));
      this.issues.update((list) => list.filter((i) => i.id !== id));
    } catch {
      // stil falen
    }
  }

  onIssueUpdated(updated: Issue): void {
    this.issues.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
  }

  // rich text toolbar
  applyFormat(command: string, editor: HTMLElement): void {
    editor.focus();
    document.execCommand(command, false, undefined);
    this.contentInput = editor.innerHTML;
  }

  onEditorInput(editor: HTMLElement): void {
    this.contentInput = editor.innerHTML;
  }

  onImagesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    for (const file of Array.from(files)) {
      this.imageFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImagePreview(i: number): void {
    this.imageFiles.splice(i, 1);
    this.imagePreviews.splice(i, 1);
  }

  toggleMenu(issueId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuIssueId.update((current) => (current === issueId ? null : issueId));
  }
}
