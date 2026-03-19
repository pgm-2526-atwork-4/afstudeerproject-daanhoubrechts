import { Component, input } from '@angular/core';

import { BalanceEntry } from '../../models/expense.interface';

@Component({
  selector: 'app-my-balance-card',
  standalone: true,
  imports: [],
  templateUrl: './my-balance-card.html',
  styleUrl: './my-balance-card.scss',
})
export class MyBalanceCard {
  readonly balance = input.required<BalanceEntry>();

  formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }
}
