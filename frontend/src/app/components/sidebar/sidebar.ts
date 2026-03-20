import { Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { UserAvatar } from '../user-avatar/user-avatar';
import { environment } from '../../../environments/environment';
import { Kotgroup } from '../../models/kotgroup.interface';
import { SidebarStateService } from './sidebar-state.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, UserAvatar, FormsModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  readonly authService = inject(AuthService);
  readonly sidebarState = inject(SidebarStateService);
  private router = inject(Router);
  private http = inject(HttpClient);

  readonly avatarUrl = computed(() => this.authService.userProfile()?.avatar_url ?? null);
  readonly firstName = computed(() => this.authService.userProfile()?.first_name ?? '');
  readonly lastName = computed(() => this.authService.userProfile()?.last_name ?? '');

  kotgroepen = signal<Kotgroup[]>([]);
  currentKotgroepId = signal<string | null>(null);
  currentKotgroep = computed(() => {
    const id = this.currentKotgroepId();
    if (!id) return null;
    return this.kotgroepen().find((k) => k.id === id) || null;
  });

  constructor() {
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.loadKotgroepen();
      } else {
        this.kotgroepen.set([]);
      }
    });
  }

  ngOnInit() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateCurrentKotgroep(event.urlAfterRedirects);
        // sluit sidebar op mobile na navigatie
        this.sidebarState.close();
      });
    this.updateCurrentKotgroep(this.router.url);
  }

  updateCurrentKotgroep(url: string) {
    const match = url.match(/\/kotgroepen\/([a-zA-Z0-9-]+)/);
    if (match) {
      this.currentKotgroepId.set(match[1]);
    } else {
      this.currentKotgroepId.set(null);
    }
  }

  loadKotgroepen() {
    this.http.get<Kotgroup[]>(`${environment.apiUrl}/kotgroepen`).subscribe({
      next: (data) => this.kotgroepen.set(data),
      error: () => {},
    });
  }

  async logout(): Promise<void> {
    this.sidebarState.close();
    await this.authService.logout();
  }
}
