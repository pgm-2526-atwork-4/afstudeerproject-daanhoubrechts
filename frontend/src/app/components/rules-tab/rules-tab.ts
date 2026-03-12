import { Component, inject, input, output, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { KotgroupDetail, UpdateKotgroupData } from '../../models/kotgroup.interface';
import { environment } from '../../../environments/environment';
import { Alert } from '../alert/alert';

@Component({
  selector: 'app-rules-tab',
  imports: [FormsModule, Alert],
  templateUrl: './rules-tab.html',
  styleUrl: './rules-tab.scss',
})
export class RulesTab {
  private http = inject(HttpClient);

  readonly group = input.required<KotgroupDetail>();
  readonly isKotbaas = input(false);

  readonly groupUpdated = output<KotgroupDetail>();

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  rulesInput = '';

  startEdit(): void {
    this.rulesInput = this.group().rules ?? '';
    this.editing.set(true);
    this.saveError.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    const id = this.group().id;
    this.saving.set(true);
    this.saveError.set(null);

    const update: UpdateKotgroupData = { rules: this.rulesInput.trim() || null };

    this.http.patch<KotgroupDetail>(`${environment.apiUrl}/kotgroepen/${id}`, update).subscribe({
      next: (updated) => {
        this.editing.set(false);
        this.saving.set(false);
        this.groupUpdated.emit(updated);
      },
      error: (err) => {
        this.saveError.set(err.error?.error ?? 'Opslaan mislukt.');
        this.saving.set(false);
      },
    });
  }
}
