import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';

interface InviteInfo {
  kotgroup_id: string;
  name: string;
  address: string | null;
}

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './join.html',
  styleUrl: './join.scss',
})
export class Join implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly invite = signal<InviteInfo | null>(null);
  readonly accepting = signal(false);

  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.error.set('Uitnodiging ontbreekt of is ongeldig.');
      this.loading.set(false);
      return;
    }

    this.loadInvite(this.token);
  }

  private loadInvite(token: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<InviteInfo>(`${environment.apiUrl}/invites/${encodeURIComponent(token)}`).subscribe({
      next: (data) => {
        this.invite.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Uitnodiging kon niet geladen worden.');
        this.loading.set(false);
      },
    });
  }

  joinKot(): void {
    if (!this.token || !this.invite()) {
      return;
    }
    this.accepting.set(true);
    this.error.set(null);

    this.http.post<{ success: boolean; kotgroup_id: string }>(
      `${environment.apiUrl}/invites/${encodeURIComponent(this.token)}/accept`,
      {},
    ).subscribe({
      next: () => {
        this.accepting.set(false);
        this.router.navigate(['/kotgroepen']);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Kon de uitnodiging niet accepteren.');
        this.accepting.set(false);
      },
    });
  }
}

