import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-state',
  imports: [],
  templateUrl: './page-state.html',
  styleUrl: './page-state.scss',
})
export class PageState {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly empty = input(false);
  readonly emptyMessage = input('Geen resultaten gevonden.');
  readonly loadingMessage = input('Laden...');
}
