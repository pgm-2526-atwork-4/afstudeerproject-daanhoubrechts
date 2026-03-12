import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { KotgroupDetail, UpdateKotgroupData } from '../../models/kotgroup.interface';
import { environment } from '../../../environments/environment';
import { Alert } from '../alert/alert';

@Component({
  selector: 'app-wifi-tab',
  imports: [FormsModule, Alert],
  templateUrl: './wifi-tab.html',
  styleUrl: './wifi-tab.scss',
})
export class WifiTab implements OnInit {
  private http = inject(HttpClient);

  readonly group = input.required<KotgroupDetail>();
  readonly isKotbaas = input(false);

  readonly groupUpdated = output<KotgroupDetail>();

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly wifiQrDataUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);

  wifiSsidInput = '';
  wifiPasswordInput = '';

  constructor() {
    // QR opnieuw genereren als group verandert (bv. na eerste load)
    effect(() => {
      const g = this.group();
      if (g.wifi_ssid || g.wifi_password) {
        this.generateQr(g.wifi_ssid ?? '', g.wifi_password ?? '');
      } else {
        this.wifiQrDataUrl.set(null);
      }
    });
  }

  ngOnInit(): void {}

  startEdit(): void {
    this.wifiSsidInput = this.group().wifi_ssid ?? '';
    this.wifiPasswordInput = this.group().wifi_password ?? '';
    this.editing.set(true);
    this.saveError.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    const id = this.group().id;
    this.saving.set(true);
    this.saveError.set(null);

    const update: UpdateKotgroupData = {
      wifi_ssid: this.wifiSsidInput.trim() || null,
      wifi_password: this.wifiPasswordInput.trim() || null,
    };

    this.http.patch<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${id}`, update).subscribe({
      next: (updated) => {
        this.editing.set(false);
        this.saving.set(false);
        this.groupUpdated.emit(updated);
      },
      error: (err) => {
        this.saveError.set(err.error?.error ?? 'Opslaan mislukt.');
        this.saving.set(false);
      },
    });
  }

  private async generateQr(ssid: string, password: string): Promise<void> {
    this.qrLoading.set(true);
    try {
      // standaard WiFi QR formaat
      const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`;
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(wifiString, { width: 220, margin: 2 });
      this.wifiQrDataUrl.set(dataUrl);
    } catch {
      this.wifiQrDataUrl.set(null);
    } finally {
      this.qrLoading.set(false);
    }
  }
}
