import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { Sidebar } from './components/sidebar/sidebar';
import { Footer } from './components/footer/footer';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Sidebar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // huidige url als signal zodat template reageert op navigatie
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showSidebar = computed(
    () => this.authService.isLoggedIn() && this.currentUrl() !== '/',
  );

  readonly showTopNav = computed(
    () => !this.authService.isLoggedIn() || this.currentUrl() === '/',
  );
}
