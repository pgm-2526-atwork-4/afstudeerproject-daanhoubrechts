import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { KotgroupDetail, UpdateKotgroupData } from '../../models/kotgroup.interface';
import { environment } from '../../../environments/environment';
import { Tabs, Tab as TabItem } from '../../components/tabs/tabs';
import { Alert } from '../../components/alert/alert';
import { PageState } from '../../components/page-state/page-state';

type Tab = 'regels' | 'wifi';

@Component({
  selector: 'app-kotinfo',
  imports: [RouterLink, FormsModule, Tabs, Alert, PageState],
  templateUrl: './kotinfo.html',
  styleUrl: './kotinfo.scss',
})
export class Kotinfo implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly group = signal<KotgroupDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<Tab>('regels');

  // edit state
  readonly editingRules = signal(false);
  readonly editingWifi = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  rulesInput = '';
  wifiSsidInput = '';
  wifiPasswordInput = '';

  // QR code data URL
  readonly wifiQrDataUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);

  // invite state (alleen zichtbaar voor kotbaas)
  readonly inviteToken = signal<string | null>(null);
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);

  // kotbaas check: is de ingelogde user degene die de groep aangemaakt heeft?
  readonly isKotbaas = computed(() => {
    const user = this.authService.currentUser();
    const g = this.group();
    return !!user && !!g && g.created_by === user.id;
  });

  readonly kotinfoTabs: TabItem[] = [
    { id: 'regels', label: 'Regels' },
    { id: 'wifi', label: 'Wifi' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Kotgroep ID niet gevonden.');
      this.loading.set(false);
      return;
    }
    this.loadGroup(id);
  }

  private loadGroup(id: string): void {
    this.http.get<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${id}`).subscribe({
      next: (data) => {
        this.group.set(data);
        this.loading.set(false);
        if (data.wifi_ssid || data.wifi_password) {
          this.generateQr(data.wifi_ssid ?? '', data.wifi_password ?? '');
        }
      },
      error: (err) => {
        this.error.set(err.error?.error ?? err.message ?? 'Kon kotgroep niet laden.');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  startEditRules(): void {
    this.rulesInput = this.group()?.rules ?? '';
    this.editingRules.set(true);
    this.saveError.set(null);
  }

  cancelEditRules(): void {
    this.editingRules.set(false);
  }

  startEditWifi(): void {
    this.wifiSsidInput = this.group()?.wifi_ssid ?? '';
    this.wifiPasswordInput = this.group()?.wifi_password ?? '';
    this.editingWifi.set(true);
    this.saveError.set(null);
  }

  cancelEditWifi(): void {
    this.editingWifi.set(false);
  }

  saveRules(): void {
    const id = this.group()?.id;
    if (!id) return;
    this.saving.set(true);
    this.saveError.set(null);

    const update: UpdateKotgroupData = { rules: this.rulesInput.trim() || null };
    this.http.patch<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${id}`, update).subscribe({
      next: (updated) => {
        this.group.set(updated);
        this.editingRules.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        this.saveError.set(err.error?.error ?? 'Opslaan mislukt.');
        this.saving.set(false);
      },
    });
  }

  saveWifi(): void {
    const id = this.group()?.id;
    if (!id) return;
    this.saving.set(true);
    this.saveError.set(null);

    const update: UpdateKotgroupData = {
      wifi_ssid: this.wifiSsidInput.trim() || null,
      wifi_password: this.wifiPasswordInput.trim() || null,
    };

    this.http.patch<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${id}`, update).subscribe({
      next: (updated) => {
        this.group.set(updated);
        this.editingWifi.set(false);
        this.saving.set(false);

        const ssid = updated.wifi_ssid ?? '';
        const pass = updated.wifi_password ?? '';
        if (ssid || pass) {
          this.generateQr(ssid, pass);
        } else {
          this.wifiQrDataUrl.set(null);
        }
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
      // formaat: WIFI:T:<type>;S:<ssid>;P:<password>;;
      //   T = beveiligingstype (WPA/WPA2, WEP, of leeg voor open netwerk)
      //   S = netwerknaam (SSID)
      //   P = wachtwoord
      //   ;; = afsluiting van het formaat
      const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`;

      const QRCode = await import('qrcode');

      // omzetten naar een data URL voor in de template
      const dataUrl = await QRCode.toDataURL(wifiString, { width: 220, margin: 2 });
      this.wifiQrDataUrl.set(dataUrl);
    } catch {
      this.wifiQrDataUrl.set(null);
    } finally {
      this.qrLoading.set(false);
    }
  }

  get inviteUrl(): string | null {
    const token = this.inviteToken();
    if (!token) return null;
    return `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
  }

  generateInvite(): void {
    const id = this.group()?.id;
    if (!id || !this.isKotbaas()) {
      return;
    }

    this.inviteLoading.set(true);
    this.inviteError.set(null);

    this.http
      .post<{ token: string }>(`${environment.apiUrl}/kotgroepen/${id}/invites`, {})
      .subscribe({
        next: (data) => {
          this.inviteToken.set(data.token);
          this.inviteLoading.set(false);
        },
        error: (err) => {
          this.inviteError.set(err.error?.error ?? 'Uitnodiging aanmaken mislukt.');
          this.inviteLoading.set(false);
        },
      });
  }

  copyInviteUrl(): void {
    const url = this.inviteUrl;
    if (!url || !navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(url).catch(() => {
      // clipboard faalt stil, URL blijft zichtbaar zodat user zelf kan kopiëren
    });
  }
}
