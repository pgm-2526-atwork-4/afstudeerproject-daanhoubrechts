import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { KotgroupDetail } from '../../models/kotgroup.interface';
import { environment } from '../../../environments/environment';
import { Tabs, Tab as TabItem } from '../../components/tabs/tabs';
import { PageState } from '../../components/page-state/page-state';
import { InviteCard } from '../../components/invite-card/invite-card';
import { WifiTab } from '../../components/wifi-tab/wifi-tab';
import { RulesTab } from '../../components/rules-tab/rules-tab';
import { Modal } from '../../components/modal/modal';
import { MembersTab } from '../../components/members-tab/members-tab';
import { ContractTab } from '../../components/contract-tab/contract-tab';

type Tab = 'regels' | 'wifi' | 'contract' | 'leden';

@Component({
  selector: 'app-kotinfo',
  imports: [
    RouterLink,
    Tabs,
    PageState,
    InviteCard,
    WifiTab,
    RulesTab,
    MembersTab,
    ContractTab,
    FormsModule,
    Modal,
    LucideAngularModule,
  ],
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

  // modal edit state
  readonly editModalOpen = signal(false);
  readonly editName = signal('');
  readonly editAddress = signal('');
  readonly savingHeader = signal(false);
  readonly headerError = signal<string | null>(null);

  readonly isKotbaas = computed(() => {
    const user = this.authService.currentUser();
    const g = this.group();
    return !!user && !!g && g.created_by === user.id;
  });

  readonly kotinfoTabs: TabItem[] = [
    { id: 'regels', label: 'Regels' },
    { id: 'wifi', label: 'Wifi' },
    { id: 'contract', label: 'Contract' },
    { id: 'leden', label: 'Leden' },
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

  onGroupUpdated(updated: KotgroupDetail): void {
    this.group.set(updated);
  }

  openEditModal(): void {
    const g = this.group();
    if (!g) return;
    this.editName.set(g.name);
    this.editAddress.set(g.address ?? '');
    this.headerError.set(null);
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    if (this.savingHeader()) return;
    this.editModalOpen.set(false);
    this.headerError.set(null);
  }

  saveHeader(): void {
    const g = this.group();
    if (!g) return;
    const name = this.editName().trim();
    if (!name) {
      this.headerError.set('Naam mag niet leeg zijn.');
      return;
    }
    this.savingHeader.set(true);
    this.headerError.set(null);

    const address = this.editAddress().trim() || null;

    this.http
      .patch<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${g.id}`, { name, address })
      .subscribe({
        next: (updated) => {
          this.group.set(updated);
          this.editModalOpen.set(false);
          this.savingHeader.set(false);
        },
        error: (err) => {
          this.headerError.set(err.error?.error ?? err.message ?? 'Opslaan mislukt.');
          this.savingHeader.set(false);
        },
      });
  }
}
