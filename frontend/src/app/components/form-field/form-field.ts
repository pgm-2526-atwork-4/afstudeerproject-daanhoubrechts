import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  imports: [],
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
})
export class FormField {
  readonly label = input('');
  readonly for = input('');
  // null of lege string = geen error tonen
  readonly error = input<string | null>(null);
}
