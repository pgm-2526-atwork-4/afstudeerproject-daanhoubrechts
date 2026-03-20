import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { AvatarUpload } from '../../components/avatar-upload/avatar-upload';
import { Alert } from '../../components/alert/alert';
import { Tabs, Tab } from '../../components/tabs/tabs';
import { FormField } from '../../components/form-field/form-field';
import { PreferenceToggle } from '../../components/preference-toggle/preference-toggle';

type SettingsSection = 'profiel' | 'wachtwoord' | 'voorkeuren';

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const newPassword = parent.get('newPassword')?.value;
    return newPassword === control.value ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, AvatarUpload, Alert, Tabs, FormField, PreferenceToggle],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  readonly activeSection = signal<SettingsSection>('profiel');

  readonly settingsTabs: Tab[] = [
    { id: 'profiel', label: 'Profiel' },
    { id: 'wachtwoord', label: 'Wachtwoord' },
    { id: 'voorkeuren', label: 'Voorkeuren' },
  ];

  profileForm = this.fb.nonNullable.group({
    first_name: [this.authService.userProfile()?.first_name ?? '', [Validators.required, Validators.minLength(2)]],
    last_name: [this.authService.userProfile()?.last_name ?? '', [Validators.required, Validators.minLength(2)]],
    phone_number: [this.authService.userProfile()?.phone_number ?? ''],
  });

  passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, passwordMatchValidator()]],
    },
    { updateOn: 'blur' },
  );

  // signal zodat dark mode toggle direct reageert
  readonly lightDarkMode = signal(this.authService.userProfile()?.light_dark_mode ?? false);

  readonly pendingAvatarFile = signal<File | null>(null);

  readonly profileLoading = signal(false);
  readonly profileSuccess = signal(false);
  readonly profileError = signal<string | null>(null);

  readonly passwordLoading = signal(false);
  readonly passwordSuccess = signal(false);
  readonly passwordError = signal<string | null>(null);

  readonly avatarLoading = signal(false);
  readonly avatarError = signal<string | null>(null);

  readonly preferencesLoading = signal(false);
  readonly preferencesSuccess = signal(false);

  constructor() {
    this.passwordForm.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.passwordForm.controls.confirmPassword.updateValueAndValidity());
  }

  setSection(section: SettingsSection): void {
    this.activeSection.set(section);
  }

  onAvatarSelected(file: File): void {
    this.pendingAvatarFile.set(file);
  }

  async saveAvatar(): Promise<void> {
    const file = this.pendingAvatarFile();
    if (!file) return;

    this.avatarLoading.set(true);
    this.avatarError.set(null);

    try {
      await this.authService.uploadAvatar(file);
      this.pendingAvatarFile.set(null);
    } catch (err: unknown) {
      this.avatarError.set(err instanceof Error ? err.message : 'Upload mislukt.');
    } finally {
      this.avatarLoading.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileLoading.set(true);
    this.profileSuccess.set(false);
    this.profileError.set(null);

    try {
      const { first_name, last_name, phone_number } = this.profileForm.getRawValue();
      await this.authService.updateProfile({
        first_name,
        last_name,
        phone_number: phone_number || null,
      });
      this.profileSuccess.set(true);
      setTimeout(() => this.profileSuccess.set(false), 3000);
    } catch (err: unknown) {
      this.profileError.set(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      this.profileLoading.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordLoading.set(true);
    this.passwordSuccess.set(false);
    this.passwordError.set(null);

    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      await this.authService.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      this.passwordSuccess.set(true);
      setTimeout(() => this.passwordSuccess.set(false), 3000);
    } catch (err: unknown) {
      this.passwordError.set(err instanceof Error ? err.message : 'Wachtwoord wijzigen mislukt.');
    } finally {
      this.passwordLoading.set(false);
    }
  }

  async toggleLightDarkMode(): Promise<void> {
    this.lightDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.lightDarkMode());
    await this.savePreferences();
  }

  private async savePreferences(): Promise<void> {
    this.preferencesLoading.set(true);
    this.preferencesSuccess.set(false);

    try {
      await this.authService.updateProfile({
        light_dark_mode: this.lightDarkMode(),
      });
      this.preferencesSuccess.set(true);
      setTimeout(() => this.preferencesSuccess.set(false), 2000);
    } catch {
      // stille fail, toggles staan al goed
    } finally {
      this.preferencesLoading.set(false);
    }
  }
}
