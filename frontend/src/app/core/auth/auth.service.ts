import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Profile, ProfileUpdate } from '../../models/profile.interface';
import { UserRole } from '../../models/user-role.enum';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  email: string | undefined;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

// localStorage keys
const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const EXPIRES_KEY = 'auth_expires_at';

// werkt zoals useContext in React: inject in elk component via inject(AuthService)
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // de _ versies zijn alleen intern schrijfbaar, buiten de service enkel readable
  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _userProfile = signal<Profile | null>(null);
  private readonly _loading = signal(true);

  readonly currentUser = this._currentUser.asReadonly();
  readonly userProfile = this._userProfile.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly isLoggedIn = computed(() => !!this._currentUser());
  readonly userRole = computed<UserRole | null>(() => this._userProfile()?.role ?? null);
  readonly fullName = computed(() => {
    const p = this._userProfile();
    if (!p) return null;
    return `${p.first_name} ${p.last_name}`.trim() || p.email;
  });

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // al een token opgeslagen? Sessie herstellen bij opstarten
    if (this.getStoredToken()) {
      await this.loadMe();
    }
    this._loading.set(false);
  }

  async login(data: LoginData): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthTokens & { user: AuthUser }>(`${environment.apiUrl}/auth/login`, data),
    );
    this.storeTokens(response);
    this._currentUser.set(response.user);
    await this.loadMe();
    this.router.navigate(['/dashboard']);
  }

  async register(data: RegisterData): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthTokens & { user: AuthUser }>(`${environment.apiUrl}/auth/register`, data),
    );
    this.storeTokens(response);
    this._currentUser.set(response.user);
    await this.loadMe();
    this.router.navigate(['/dashboard']);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, {}));
    } catch {}
    this.clearSession();
    this.router.navigate(['/login']);
  }

  // aangeroepen door de interceptor bij 401
  async refreshTokens(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;

    try {
      const response = await firstValueFrom(
        this.http.post<AuthTokens>(`${environment.apiUrl}/auth/refresh`, {
          refresh_token: refreshToken,
        }),
      );
      this.storeTokens(response);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async updateProfile(update: ProfileUpdate): Promise<void> {
    const updated = await firstValueFrom(
      this.http.patch<Profile>(`${environment.apiUrl}/profiles/me`, update),
    );
    this._userProfile.set(updated);
  }

  getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private async loadMe(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ user: AuthUser; profile: Profile }>(`${environment.apiUrl}/auth/me`),
      );
      this._currentUser.set(response.user);
      this._userProfile.set(response.profile);
    } catch {
      this.clearSession();
    }
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    if (tokens.expires_at) {
      localStorage.setItem(EXPIRES_KEY, String(tokens.expires_at));
    }
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    this._currentUser.set(null);
    this._userProfile.set(null);
  }
}
