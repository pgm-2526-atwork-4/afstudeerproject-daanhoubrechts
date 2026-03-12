import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class Button {
  readonly variant = input<'primary' | 'secondary' | 'ghost'>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');

  readonly classes = computed(() => {
    const parts = ['btn', `btn--${this.variant()}`];
    if (this.size() === 'sm') parts.push('btn--sm');
    return parts.join(' ');
  });
}
