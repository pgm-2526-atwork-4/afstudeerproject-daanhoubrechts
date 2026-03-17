import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { Alert } from '../../components/alert/alert';
import { FormField } from '../../components/form-field/form-field';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Alert, FormField],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  get returnUrl(): string | null {
    return this.route.snapshot.queryParamMap.get('returnUrl');
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined;

    try {
      await this.authService.login(this.form.getRawValue(), returnUrl);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Inloggen mislukt.');
    } finally {
      this.loading.set(false);
    }
  }
}
