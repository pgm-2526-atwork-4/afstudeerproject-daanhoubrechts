import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { Kotgroup, CreateKotgroupData } from '../../models/kotgroup.interface';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-kotgroepen',
  imports: [RouterLink, FormsModule],
  templateUrl: './kotgroepen.html',
  styleUrl: './kotgroepen.scss',
})
export class Kotgroepen {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly authService = inject(AuthService);

  readonly kotgroepen = signal<Kotgroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // create modal state
  readonly showCreateModal = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  nameInput = '';
  addressInput = '';

  constructor() {
    this.loadKotgroepen();
  }

  loadKotgroepen(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<Kotgroup[]>(`${environment.apiUrl}/kotgroepen`).subscribe({
      next: (data) => {
        this.kotgroepen.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? err.message ?? 'Kon kotgroepen niet laden.');
        this.loading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.nameInput = '';
    this.addressInput = '';
    this.createError.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  createKotgroep(): void {
    if (!this.nameInput.trim()) {
      this.createError.set('Naam is verplicht.');
      return;
    }

    this.creating.set(true);
    this.createError.set(null);

    const payload: CreateKotgroupData = {
      name: this.nameInput.trim(),
      address: this.addressInput.trim() || undefined,
    };

    this.http.post<Kotgroup>(`${environment.apiUrl}/kotgroepen`, payload).subscribe({
      next: (group) => {
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.router.navigate(['/kotgroepen', group.id, 'kotinfo']);
      },
      error: (err) => {
        this.createError.set(err.error?.error ?? 'Aanmaken mislukt.');
        this.creating.set(false);
      },
    });
  }
}
