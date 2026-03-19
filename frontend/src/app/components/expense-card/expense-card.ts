import { Component, input, output, signal } from '@angular/core';

import { Expense } from '../../models/expense.interface';
import { UserAvatar } from '../user-avatar/user-avatar';
import { PostMenu } from '../post-menu/post-menu';

@Component({
  selector: 'app-expense-card',
  standalone: true,
  imports: [UserAvatar, PostMenu],
  templateUrl: './expense-card.html',
  styleUrl: './expense-card.scss',
})
export class ExpenseCard {
  readonly expense = input.required<Expense>();

  readonly editRequested = output<Expense>();
  readonly deleteRequested = output<string>();

  readonly menuOpen = signal(false);

  readonly menuActions = [
    { label: 'Bewerken' },
    { label: 'Verwijderen', danger: true },
  ];

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  onActionSelected(index: number): void {
    this.menuOpen.set(false);
    if (index === 0) {
      this.editRequested.emit(this.expense());
    } else if (index === 1) {
      this.deleteRequested.emit(this.expense().id);
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('nl-BE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
