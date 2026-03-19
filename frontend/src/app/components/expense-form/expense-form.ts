import { Component, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { Expense } from '../../models/expense.interface';
import { KotgroupMember } from '../members-tab/members-tab';
import { UserAvatar } from '../user-avatar/user-avatar';

export interface ExpenseFormData {
  title: string;
  amount: number;
  paidBy: string;
  participantIds: string[];
}

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, UserAvatar],
  templateUrl: './expense-form.html',
  styleUrl: './expense-form.scss',
})
export class ExpenseForm implements OnInit {
  readonly members = input<KotgroupMember[]>([]);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  // bij edit mode, anders null voor create mode
  readonly editingExpense = input<Expense | null>(null);
  readonly defaultPayerId = input('');

  readonly submitted = output<ExpenseFormData>();
  readonly cancelled = output<void>();

  titleInput = '';
  amountInput: number | null = null;
  paidByInput = '';
  selectedParticipantIds: string[] = [];
  validationError: string | null = null;

  ngOnInit(): void {
    const expense = this.editingExpense();
    if (expense) {
      this.titleInput = expense.title;
      this.amountInput = expense.amount;
      this.paidByInput = expense.paid_by;
      this.selectedParticipantIds = expense.participants.map((p) => p.id);
    } else {
      this.paidByInput = this.defaultPayerId();
      this.selectedParticipantIds = this.members().map((m) => m.id);
    }
  }

  toggleParticipant(memberId: string): void {
    if (this.selectedParticipantIds.includes(memberId)) {
      this.selectedParticipantIds = this.selectedParticipantIds.filter((id) => id !== memberId);
    } else {
      this.selectedParticipantIds = [...this.selectedParticipantIds, memberId];
    }
  }

  isParticipantSelected(memberId: string): boolean {
    return this.selectedParticipantIds.includes(memberId);
  }

  memberName(member: KotgroupMember): string {
    return `${member.first_name} ${member.last_name}`.trim() || 'Onbekend';
  }

  formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }

  submit(): void {
    this.validationError = null;

    if (!this.titleInput.trim()) {
      this.validationError = 'Titel is verplicht.';
      return;
    }
    if (!this.amountInput || this.amountInput <= 0) {
      this.validationError = 'Bedrag moet groter dan 0 zijn.';
      return;
    }
    if (!this.paidByInput) {
      this.validationError = 'Kies wie betaald heeft.';
      return;
    }
    if (this.selectedParticipantIds.length === 0) {
      this.validationError = 'Kies minstens één deelnemer.';
      return;
    }

    this.submitted.emit({
      title: this.titleInput.trim(),
      amount: this.amountInput,
      paidBy: this.paidByInput,
      participantIds: this.selectedParticipantIds,
    });
  }

  // gecombineerde error: component validatie of parent error
  get displayError(): string | null {
    return this.validationError ?? this.error();
  }
}
