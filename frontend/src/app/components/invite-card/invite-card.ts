import { Component, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';

import { environment } from '../../../environments/environment';
import { Alert } from '../alert/alert';

@Component({
  selector: 'app-invite-card',
  imports: [Alert, LucideAngularModule],
  templateUrl: './invite-card.html',
  styleUrl: './invite-card.scss',
})
export class InviteCard {
  private http = inject(HttpClient);

  readonly kotgroupId = input.required<string>();

  readonly inviteToken = signal<string | null>(null);
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);

  get inviteUrl(): string | null {
    const token = this.inviteToken();
    if (!token) return null;
    return `${window.location.origin}/join?token=${encodeURIComponent(token)}`;
  }

  generateInvite(): void {
    this.inviteLoading.set(true);
    this.inviteError.set(null);

    this.http
      .post<{ token: string }>(`${environment.apiUrl}/kotgroepen/${this.kotgroupId()}/invites`, {})
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
    if (!url || !navigator.clipboard) return;
    navigator.clipboard.writeText(url).catch(() => {
      // clipboard faalt stil, URL blijft zichtbaar
    });
  }
}
