import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../models/user-role.enum';
import { AvatarUpload } from '../../components/avatar-upload/avatar-upload';

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const password = parent.get('password')?.value;
    const confirm = control.value;
    return password === confirm ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AvatarUpload],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);

  readonly totalSteps = 4;
  readonly currentStep = signal(1);

  form = this.fb.nonNullable.group(
    {
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirm: ['', [Validators.required, passwordMatchValidator()]],
      role: this.fb.nonNullable.control<UserRole>('kotgenoot', Validators.required),
    },
    { updateOn: 'blur' },
  );

  readonly selectedAvatarFile = signal<File | null>(null);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  get returnUrl(): string | null {
    return this.route.snapshot.queryParamMap.get('returnUrl');
  }

  get roleOptions(): { value: UserRole; label: string }[] {
    return [
      { value: 'kotgenoot', label: 'Kotgenoot' },
      { value: 'kotbaas', label: 'Kotbaas' },
    ];
  }

  ngOnInit(): void {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.passwordConfirm.updateValueAndValidity());
  }

  stepInvalid(step: number): boolean {
    switch (step) {
      case 1:
        return (
          this.form.controls.first_name.invalid ||
          this.form.controls.last_name.invalid ||
          this.form.controls.email.invalid
        );
      case 2:
        return this.form.controls.password.invalid || this.form.controls.passwordConfirm.invalid;
      case 3:
        return false;
      case 4:
        return false;
      default:
        return false;
    }
  }

  nextStep(): void {
    const step = this.currentStep();
    if (this.stepInvalid(step)) {
      this.form.markAllAsTouched();
      return;
    }
    if (step < this.totalSteps) {
      this.currentStep.set(step + 1);
    }
  }

  prevStep(): void {
    const step = this.currentStep();
    if (step > 1) {
      this.currentStep.set(step - 1);
    }
  }

  onAvatarSelected(file: File): void {
    this.selectedAvatarFile.set(file);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const { passwordConfirm: _, ...registerPayload } = raw;

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined;

    try {
      await this.authService.register(registerPayload, returnUrl);

      // avatar uploaden nadat account bestaat en tokens zijn opgeslagen
      const avatarFile = this.selectedAvatarFile();
      if (avatarFile) {
        await this.authService.uploadAvatar(avatarFile);
      }
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Registratie mislukt.');
    } finally {
      this.loading.set(false);
    }
  }
}
