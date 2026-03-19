import { Pipe, PipeTransform } from '@angular/core';

// pure pipe: enkel opnieuw berekend als de input string verandert
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Zonet';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min geleden`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} uur geleden`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} dagen geleden`;
    return date.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
