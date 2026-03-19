import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'formatAmount', standalone: true })
export class FormatAmountPipe implements PipeTransform {
  transform(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
  }
}
