import { Component, inject, input, signal, computed } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-contract-viewer',
  imports: [LucideAngularModule],
  templateUrl: './contract-viewer.html',
  styleUrl: './contract-viewer.scss',
})
export class ContractViewer {
  private sanitizer = inject(DomSanitizer);

  readonly contractUrl = input.required<string>();
  readonly memberName = input<string>('');
  // als true: geen eigen actieknoppen tonen (parent beheert dat zelf)
  readonly actionsHidden = input(false);

  readonly showPreview = signal(false);

  readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.contractUrl()),
  );

  togglePreview(): void {
    this.showPreview.update((v) => !v);
  }

  downloadContract(): void {
    const a = document.createElement('a');
    a.href = this.contractUrl();
    a.download = this.memberName() ? `contract-${this.memberName()}.pdf` : 'contract.pdf';
    a.target = '_blank';
    a.click();
  }
}
