import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { UserAvatar } from '../user-avatar/user-avatar';

export interface KotgroupMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  role: string;
}

interface MembersResponse {
  members: KotgroupMember[];
  kotbaas_id: string;
}

@Component({
  selector: 'app-members-tab',
  imports: [UserAvatar, LucideAngularModule],
  templateUrl: './members-tab.html',
  styleUrl: './members-tab.scss',
})
export class MembersTab implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly kotgroupId = input.required<string>();

  readonly members = signal<KotgroupMember[]>([]);
  readonly kotbaasId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  // kotbaas bovenaan sorteren
  readonly sortedMembers = computed(() => {
    const kotbaas = this.kotbaasId();
    return [...this.members()].sort((a, b) => {
      if (a.id === kotbaas) return -1;
      if (b.id === kotbaas) return 1;
      return 0;
    });
  });

  ngOnInit(): void {
    this.loadMembers();
  }

  private loadMembers(): void {
    this.http
      .get<MembersResponse>(`${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/members`)
      .subscribe({
        next: (data) => {
          this.members.set(data.members);
          this.kotbaasId.set(data.kotbaas_id);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Leden laden mislukt.');
          this.loading.set(false);
        },
      });
  }

  isKotbaas(memberId: string): boolean {
    return memberId === this.kotbaasId();
  }

  isCurrentUser(memberId: string): boolean {
    return memberId === this.currentUserId();
  }

  fullName(member: KotgroupMember): string {
    return `${member.first_name} ${member.last_name}`.trim() || 'Onbekend';
  }
}
