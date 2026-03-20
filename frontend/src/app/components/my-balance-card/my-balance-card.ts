import { Component, input } from '@angular/core';

import { BalanceEntry } from '../../models/expense.interface';
import { FormatAmountPipe } from '../../pipes/format-amount.pipe';

@Component({
  selector: 'app-my-balance-card',
  standalone: true,
  imports: [FormatAmountPipe],
  templateUrl: './my-balance-card.html',
  styleUrl: './my-balance-card.scss',
})
export class MyBalanceCard {
  readonly balance = input.required<BalanceEntry>();
}
