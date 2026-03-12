import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-preference-toggle',
  imports: [],
  templateUrl: './preference-toggle.html',
  styleUrl: './preference-toggle.scss',
})
export class PreferenceToggle {
  readonly label = input.required<string>();
  readonly description = input('');
  readonly value = input(false);
  readonly disabled = input(false);

  readonly toggled = output<void>();
}
