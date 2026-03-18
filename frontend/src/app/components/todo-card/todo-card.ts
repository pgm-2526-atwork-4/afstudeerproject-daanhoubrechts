import { Component, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

import { Todo, TodoStatus } from '../../models/todo.interface';
import { UserAvatar } from '../user-avatar/user-avatar';

@Component({
  selector: 'app-todo-card',
  imports: [LucideAngularModule, UserAvatar],
  templateUrl: './todo-card.html',
  styleUrl: './todo-card.scss',
})
export class TodoCard {
  readonly todo = input.required<Todo>();
  readonly currentUserId = input<string | null>(null);

  readonly statusChanged = output<{ id: string; status: TodoStatus }>();
  readonly editRequested = output<Todo>();
  readonly deleteRequested = output<string>();

  readonly menuOpen = signal(false);

  readonly statusCycle: TodoStatus[] = ['todo', 'bezig', 'klaar'];

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  nextStatus(): void {
    const current = this.todo().status;
    const idx = this.statusCycle.indexOf(current);
    const next = this.statusCycle[(idx + 1) % this.statusCycle.length];
    this.statusChanged.emit({ id: this.todo().id, status: next });
  }

  statusLabel(status: TodoStatus): string {
    const labels: Record<TodoStatus, string> = {
      todo: 'Te doen',
      bezig: 'Bezig',
      klaar: 'Klaar',
    };
    return labels[status];
  }

  priorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      laag: 'Laag',
      normaal: 'Normaal',
      dringend: 'Dringend',
      urgent: 'Urgent',
    };
    return labels[priority] ?? priority;
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.editRequested.emit(this.todo());
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.deleteRequested.emit(this.todo().id);
  }
}
