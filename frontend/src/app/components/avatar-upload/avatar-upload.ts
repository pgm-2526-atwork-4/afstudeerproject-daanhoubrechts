import { Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-avatar-upload',
  imports: [],
  templateUrl: './avatar-upload.html',
  styleUrl: './avatar-upload.scss',
})
export class AvatarUpload {
  readonly currentUrl = input<string | null>(null);
  readonly disabled = input(false);

  // stuurt het geselecteerde File object omhoog naar de parent
  readonly fileSelected = output<File>();

  readonly previewUrl = signal<string | null>(null);
  readonly dragOver = signal(false);

  // preview heeft voorrang op de opgeslagen url
  readonly displayUrl = computed(() => this.previewUrl() ?? this.currentUrl());

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.disabled()) return;

    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  private handleFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
    this.fileSelected.emit(file);
  }
}
