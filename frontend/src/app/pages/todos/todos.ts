import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { Todo, TodoPriority, TodoStatus } from '../../models/todo.interface';
import { environment } from '../../../environments/environment';
import { PageHeader } from '../../components/page-header/page-header';
import { FormField } from '../../components/form-field/form-field';
import { TodoCard } from '../../components/todo-card/todo-card';
import { Modal } from '../../components/modal/modal';
import { PageState } from '../../components/page-state/page-state';
import { KotgroupMember } from '../../components/members-tab/members-tab';
import { UserAvatar } from '../../components/user-avatar/user-avatar';

interface MembersResponse {
  members: KotgroupMember[];
  kotbaas_id: string;
}

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [RouterLink, FormsModule, PageHeader, FormField, TodoCard, Modal, PageState, LucideAngularModule, UserAvatar],
  templateUrl: './todos.html',
  styleUrl: './todos.scss',
})
export class Todos implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly kotgroupId = signal<string | null>(null);
  readonly todos = signal<Todo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly members = signal<KotgroupMember[]>([]);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly backLink = computed(() =>
    this.kotgroupId() ? `/kotgroepen/${this.kotgroupId()}/kotinfo` : '/kotgroepen',
  );

  // gefilterde lijsten per status
  readonly todoItems = computed(() => this.todos().filter((t) => t.status === 'todo'));
  readonly bezigItems = computed(() => this.todos().filter((t) => t.status === 'bezig'));
  readonly klaarItems = computed(() => this.todos().filter((t) => t.status === 'klaar'));

  // drag state
  readonly draggingId = signal<string | null>(null);
  readonly dragOverStatus = signal<TodoStatus | null>(null);

  // modal state
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly editingTodo = signal<Todo | null>(null);

  // form velden
  titleInput = '';
  descriptionInput = '';
  statusInput: TodoStatus = 'todo';
  priorityInput: TodoPriority = 'normaal';
  selectedAssigneeIds: string[] = [];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Kotgroep ID niet gevonden.');
      this.loading.set(false);
      return;
    }
    this.kotgroupId.set(id);
    this.loadTodos(id);
    this.loadMembers(id);
  }

  private loadTodos(kotgroupId: string): void {
    this.http.get<Todo[]>(`${environment.apiUrl}/todos?kotgroupId=${kotgroupId}`).subscribe({
      next: (data) => {
        this.todos.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.error ?? 'Taken laden mislukt.');
        this.loading.set(false);
      },
    });
  }

  private loadMembers(kotgroupId: string): void {
    this.http
      .get<MembersResponse>(`${environment.apiUrl}/kotgroepen/${kotgroupId}/members`)
      .subscribe({
        next: (data) => this.members.set(data.members),
        error: () => {},
      });
  }

  openCreateModal(): void {
    this.editingTodo.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(todo: Todo): void {
    this.editingTodo.set(todo);
    this.titleInput = todo.title;
    this.descriptionInput = todo.description ?? '';
    this.statusInput = todo.status;
    this.priorityInput = todo.priority;
    this.selectedAssigneeIds = todo.assignees.map((a) => a.id);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.showModal.set(false);
  }

  private resetForm(): void {
    this.titleInput = '';
    this.descriptionInput = '';
    this.statusInput = 'todo';
    this.priorityInput = 'normaal';
    this.selectedAssigneeIds = [];
    this.modalError.set(null);
  }

  toggleAssignee(memberId: string): void {
    if (this.selectedAssigneeIds.includes(memberId)) {
      this.selectedAssigneeIds = this.selectedAssigneeIds.filter((id) => id !== memberId);
    } else {
      this.selectedAssigneeIds = [...this.selectedAssigneeIds, memberId];
    }
  }

  isAssigneeSelected(memberId: string): boolean {
    return this.selectedAssigneeIds.includes(memberId);
  }

  async submitTodo(): Promise<void> {
    const kotgroupId = this.kotgroupId();
    if (!kotgroupId) return;
    if (!this.titleInput.trim()) {
      this.modalError.set('Titel is verplicht.');
      return;
    }

    this.saving.set(true);
    this.modalError.set(null);

    try {
      const editing = this.editingTodo();

      if (editing) {
        const updated = await firstValueFrom(
          this.http.patch<Todo>(`${environment.apiUrl}/todos/${editing.id}`, {
            title: this.titleInput.trim(),
            description: this.descriptionInput || null,
            status: this.statusInput,
            priority: this.priorityInput,
            assignee_ids: this.selectedAssigneeIds,
          }),
        );
        this.todos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await firstValueFrom(
          this.http.post<Todo>(`${environment.apiUrl}/todos`, {
            kotgroup_id: kotgroupId,
            title: this.titleInput.trim(),
            description: this.descriptionInput || null,
            status: this.statusInput,
            priority: this.priorityInput,
            assignee_ids: this.selectedAssigneeIds,
          }),
        );
        this.todos.update((list) => [created, ...list]);
      }

      this.showModal.set(false);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.modalError.set(e.error?.error ?? 'Opslaan mislukt.');
    } finally {
      this.saving.set(false);
    }
  }

  onDragStart(id: string): void {
    this.draggingId.set(id);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverStatus.set(null);
  }

  onDragOver(event: DragEvent, status: TodoStatus): void {
    event.preventDefault();
    this.dragOverStatus.set(status);
  }

  onDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    const related = event.relatedTarget as Node | null;
    if (related && target.contains(related)) return;
    this.dragOverStatus.set(null);
  }

  async onDrop(status: TodoStatus): Promise<void> {
    const id = this.draggingId();
    if (!id) return;
    const todo = this.todos().find((t) => t.id === id);
    this.draggingId.set(null);
    this.dragOverStatus.set(null);
    if (!todo || todo.status === status) return;
    await this.onStatusChanged({ id, status });
  }

  async onStatusChanged(event: { id: string; status: TodoStatus }): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<Todo>(`${environment.apiUrl}/todos/${event.id}`, { status: event.status }),
      );
      this.todos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      // stil falen
    }
  }

  async deleteTodo(id: string): Promise<void> {
    if (!confirm('Taak verwijderen?')) return;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/todos/${id}`));
      this.todos.update((list) => list.filter((t) => t.id !== id));
    } catch {
      // stil falen
    }
  }

  memberName(member: KotgroupMember): string {
    return `${member.first_name} ${member.last_name}`.trim() || 'Onbekend';
  }
}
