import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

import { environment } from '../../../environments/environment';
import { MemberContract } from '../../models/kotgroup.interface';

@Component({
  selector: 'app-contract-upload',
  imports: [LucideAngularModule],
  templateUrl: './contract-upload.html',
  styleUrl: './contract-upload.scss',
})
export class ContractUpload {
  private http = inject(HttpClient);

  readonly kotgroupId = input.required<string>();
  readonly memberId = input.required<string>();
  // compact=true: enkel een kleine uploadknop, geen drag-drop zone
  readonly compact = input(false);

  readonly contractUploaded = output<MemberContract>();

  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dragOver = signal(false);

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  openPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  private upload(file: File): void {
    if (file.type !== 'application/pdf') {
      this.error.set('Alleen PDF bestanden zijn toegestaan.');
      return;
    }

    this.error.set(null);
    this.uploading.set(true);

    const formData = new FormData();
    formData.append('file', file);

    this.http
      .post<MemberContract>(
        `${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/contracts/${this.memberId()}`,
        formData,
      )
      .subscribe({
        next: (contract) => {
          this.uploading.set(false);
          this.contractUploaded.emit(contract);
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Upload mislukt.');
          this.uploading.set(false);
        },
      });
  }
}
