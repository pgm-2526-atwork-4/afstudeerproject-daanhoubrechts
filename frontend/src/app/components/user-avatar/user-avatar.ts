import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  imports: [],
  templateUrl: './user-avatar.html',
  styleUrl: './user-avatar.scss',
})
export class UserAvatar {
  readonly avatarUrl = input<string | null>(null);
  readonly firstName = input('');
  readonly lastName = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  readonly initials = computed(() => {
    const f = this.firstName().charAt(0);
    const l = this.lastName().charAt(0);
    return `${f}${l}`.toUpperCase() || '?';
  });

  readonly altText = computed(() => `${this.firstName()} ${this.lastName()}`.trim() || 'Avatar');
}
