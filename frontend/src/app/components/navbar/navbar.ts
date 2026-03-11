import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly authService = inject(AuthService);

  readonly avatarUrl = computed(() => this.authService.userProfile()?.avatar_url ?? null);

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
