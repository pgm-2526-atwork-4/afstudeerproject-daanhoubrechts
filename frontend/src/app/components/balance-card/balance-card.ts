import { Component, input } from '@angular/core';

import { BalanceEntry } from '../../models/expense.interface';
import { UserAvatar } from '../user-avatar/user-avatar';

@Component({
  selector: 'app-balance-card',
  standalone: true,
  imports: [UserAvatar],
  templateUrl: './balance-card.html',
  styleUrl: './balance-card.scss',
})
export class BalanceCard {
  readonly entry = input.required<BalanceEntry>();

  firstName(): string {
    const parts = this.entry().name.split(' ');
    return parts[0] || '';
  }

  lastName(): string {
    return this.entry().name.split(' ').slice(1).join(' ');
  }

  formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }
}
