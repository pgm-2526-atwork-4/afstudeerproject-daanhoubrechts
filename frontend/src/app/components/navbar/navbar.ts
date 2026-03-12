import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { UserAvatar } from '../user-avatar/user-avatar';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, UserAvatar],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly authService = inject(AuthService);

  readonly avatarUrl = computed(() => this.authService.userProfile()?.avatar_url ?? null);
  readonly firstName = computed(() => this.authService.userProfile()?.first_name ?? '');
  readonly lastName = computed(() => this.authService.userProfile()?.last_name ?? '');

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
