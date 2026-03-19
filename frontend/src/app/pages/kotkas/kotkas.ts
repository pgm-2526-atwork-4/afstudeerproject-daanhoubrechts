import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { Expense, BalancesResponse, BalanceEntry } from '../../models/expense.interface';
import { environment } from '../../../environments/environment';
import { Modal } from '../../components/modal/modal';
import { PageState } from '../../components/page-state/page-state';
import { KotgroupMember } from '../../components/members-tab/members-tab';
import { ExpenseCard } from '../../components/expense-card/expense-card';
import { BalanceCard } from '../../components/balance-card/balance-card';
import { MyBalanceCard } from '../../components/my-balance-card/my-balance-card';
import { SettlementList } from '../../components/settlement-list/settlement-list';
import { ExpenseForm, ExpenseFormData } from '../../components/expense-form/expense-form';

interface MembersResponse {
  members: KotgroupMember[];
  kotbaas_id: string;
}

@Component({
  selector: 'app-kotkas',
  standalone: true,
  imports: [
    RouterLink,
    Modal,
    PageState,
    LucideAngularModule,
    ExpenseCard,
    BalanceCard,
    MyBalanceCard,
    SettlementList,
    ExpenseForm,
  ],
  templateUrl: './kotkas.html',
  styleUrl: './kotkas.scss',
})
export class Kotkas implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  readonly kotgroupId = signal<string | null>(null);
  readonly expenses = signal<Expense[]>([]);
  readonly balancesData = signal<BalancesResponse | null>(null);
  readonly members = signal<KotgroupMember[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly backLink = computed(() =>
    this.kotgroupId() ? `/kotgroepen/${this.kotgroupId()}/kotinfo` : '/kotgroepen',
  );

  // eigen balans uit de lijst halen
  readonly myBalance = computed<BalanceEntry | null>(() => {
    const uid = this.currentUserId();
    if (!uid) return null;
    return this.balancesData()?.balances.find((b) => b.userId === uid) ?? null;
  });

  readonly allBalances = computed(() => this.balancesData()?.balances ?? []);
  readonly settlements = computed(() => this.balancesData()?.settlements ?? []);

  // modal state
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly editingExpense = signal<Expense | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Kotgroep ID niet gevonden.');
      this.loading.set(false);
      return;
    }
    this.kotgroupId.set(id);
    this.loadMembers(id);
    this.loadExpenses(id);
    this.loadBalances(id);
  }

  private loadExpenses(kotgroupId: string): void {
    this.http
      .get<Expense[]>(`${environment.apiUrl}/kotkas?kotgroupId=${kotgroupId}`)
      .subscribe({
        next: (data) => {
          this.expenses.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.error ?? 'Uitgaven laden mislukt.');
          this.loading.set(false);
        },
      });
  }

  private loadBalances(kotgroupId: string): void {
    this.http
      .get<BalancesResponse>(`${environment.apiUrl}/kotkas/balances?kotgroupId=${kotgroupId}`)
      .subscribe({
        next: (data) => this.balancesData.set(data),
        error: () => {},
      });
  }

  private loadMembers(kotgroupId: string): void {
    this.http
      .get<MembersResponse>(`${environment.apiUrl}/kotgroepen/${kotgroupId}/members`)
      .subscribe({
        next: (data) => this.members.set(data.members),
        error: () => {},
      });
  }

  openCreateModal(): void {
    this.editingExpense.set(null);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  openEditModal(expense: Expense): void {
    this.editingExpense.set(expense);
    this.modalError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.showModal.set(false);
  }

  async onFormSubmitted(data: ExpenseFormData): Promise<void> {
    const kotgroupId = this.kotgroupId();
    if (!kotgroupId) return;

    this.saving.set(true);
    this.modalError.set(null);

    try {
      const editing = this.editingExpense();

      if (editing) {
        const updated = await firstValueFrom(
          this.http.patch<Expense>(`${environment.apiUrl}/kotkas/${editing.id}`, {
            title: data.title,
            amount: data.amount,
            paid_by: data.paidBy,
            participant_ids: data.participantIds,
          }),
        );
        this.expenses.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        const created = await firstValueFrom(
          this.http.post<Expense>(`${environment.apiUrl}/kotkas`, {
            kotgroup_id: kotgroupId,
            title: data.title,
            amount: data.amount,
            paid_by: data.paidBy,
            participant_ids: data.participantIds,
          }),
        );
        this.expenses.update((list) => [created, ...list]);
      }

      this.loadBalances(kotgroupId);
      this.showModal.set(false);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.modalError.set(e.error?.error ?? 'Opslaan mislukt.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteExpense(id: string): Promise<void> {
    if (!confirm('Uitgave verwijderen?')) return;
    const kotgroupId = this.kotgroupId();
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/kotkas/${id}`));
      this.expenses.update((list) => list.filter((e) => e.id !== id));
      if (kotgroupId) this.loadBalances(kotgroupId);
    } catch {
      // stil falen
    }
  }
}
