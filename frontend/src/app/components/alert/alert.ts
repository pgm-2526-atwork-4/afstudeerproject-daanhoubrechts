import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alert',
  imports: [],
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
})
export class Alert {
  readonly message = input<string | null>(null);
  readonly type = input<'error' | 'success'>('error');
}
