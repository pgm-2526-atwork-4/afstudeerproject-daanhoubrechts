import { Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

import { SettlementEntry } from '../../models/expense.interface';

@Component({
  selector: 'app-settlement-list',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './settlement-list.html',
  styleUrl: './settlement-list.scss',
})
export class SettlementList {
  readonly settlements = input.required<SettlementEntry[]>();

  formatAmount(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }
}
