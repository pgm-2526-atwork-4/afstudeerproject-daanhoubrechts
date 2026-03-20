import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { MemberContract } from '../../models/kotgroup.interface';
import { KotgroupMember } from '../members-tab/members-tab';
import { environment } from '../../../environments/environment';
import { ContractViewer } from '../contract-viewer/contract-viewer';
import { ContractUpload } from '../contract-upload/contract-upload';
import { UserAvatar } from '../user-avatar/user-avatar';

interface MembersResponse {
  members: KotgroupMember[];
  kotbaas_id: string;
}

interface MemberWithContract {
  member: KotgroupMember;
  contract: MemberContract | null;
}

@Component({
  selector: 'app-contract-tab',
  imports: [LucideAngularModule, ContractViewer, ContractUpload, UserAvatar],
  templateUrl: './contract-tab.html',
  styleUrl: './contract-tab.scss',
})
export class ContractTab implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly kotgroupId = input.required<string>();
  readonly isKotbaas = input(false);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly members = signal<KotgroupMember[]>([]);
  readonly contracts = signal<MemberContract[]>([]);

  readonly myContract = signal<MemberContract | null>(null);
  readonly myContractLoading = signal(true);
  readonly myContractError = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  // set van member IDs waarvoor de preview open staat
  readonly openPreviews = signal<Set<string>>(new Set());

  readonly membersWithContracts = computed<MemberWithContract[]>(() => {
    const contractMap = new Map(this.contracts().map((c) => [c.member_id, c]));
    return this.members().map((m) => ({
      member: m,
      contract: contractMap.get(m.id) ?? null,
    }));
  });

  ngOnInit(): void {
    if (this.isKotbaas()) {
      this.loadKotbaasView();
    } else {
      this.loadMyContract();
    }
  }

  private loadKotbaasView(): void {
    this.loading.set(true);
    this.http
      .get<MembersResponse>(`${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/members`)
      .subscribe({
        next: (data) => {
          const withoutKotbaas = data.members.filter((m) => m.id !== data.kotbaas_id);
          this.members.set(withoutKotbaas);
          this.loadAllContracts();
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Leden laden mislukt.');
          this.loading.set(false);
        },
      });
  }

  private loadAllContracts(): void {
    this.http
      .get<MemberContract[]>(`${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/contracts`)
      .subscribe({
        next: (data) => {
          this.contracts.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.contracts.set([]);
          this.loading.set(false);
        },
      });
  }

  private loadMyContract(): void {
    const userId = this.currentUserId();
    if (!userId) {
      this.myContractLoading.set(false);
      return;
    }
    this.http
      .get<MemberContract>(
        `${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/contracts/${userId}`,
      )
      .subscribe({
        next: (data) => {
          this.myContract.set(data);
          this.myContractLoading.set(false);
        },
        error: (err) => {
          if (err.status !== 404) {
            this.myContractError.set(err.error?.error ?? 'Contract laden mislukt.');
          }
          this.myContractLoading.set(false);
        },
      });
  }

  isPreviewOpen(memberId: string): boolean {
    return this.openPreviews().has(memberId);
  }

  togglePreview(memberId: string): void {
    this.openPreviews.update((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  onContractUploaded(memberId: string, contract: MemberContract): void {
    this.contracts.update((prev) => {
      const filtered = prev.filter((c) => c.member_id !== memberId);
      return [...filtered, contract];
    });
  }

  deleteContract(memberId: string): void {
    this.http
      .delete(`${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/contracts/${memberId}`)
      .subscribe({
        next: () => {
          this.contracts.update((prev) => prev.filter((c) => c.member_id !== memberId));
          this.openPreviews.update((prev) => {
            const next = new Set(prev);
            next.delete(memberId);
            return next;
          });
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Verwijderen mislukt.');
        },
      });
  }

  fullName(member: KotgroupMember): string {
    return `${member.first_name} ${member.last_name}`.trim() || 'Onbekend';
  }
}
