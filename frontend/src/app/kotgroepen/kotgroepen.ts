import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

export interface Kotgroup {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

@Component({
  selector: 'app-kotgroepen',
  imports: [CommonModule],
  templateUrl: './kotgroepen.html',
  styleUrl: './kotgroepen.scss',
})
export class Kotgroepen {
  private http = inject(HttpClient);

  kotgroepen = signal<Kotgroup[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.loadKotgroepen();
  }

  loadKotgroepen(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<Kotgroup[]>('http://localhost:4000/api/kotgroepen')
      .subscribe({
        next: (data) => {
          this.kotgroepen.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Kon kotgroepen niet laden.');
          this.loading.set(false);
        },
      });
  }
}
