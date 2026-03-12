import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly title = input('');

  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }

  // sluit modal bij Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
