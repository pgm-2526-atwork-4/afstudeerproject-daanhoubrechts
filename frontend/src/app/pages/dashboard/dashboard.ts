import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { Kotgroup } from '../../models/kotgroup.interface';
import { Todo } from '../../models/todo.interface';
import { Post } from '../../models/post.interface';
import { environment } from '../../../environments/environment';
import { UserAvatar } from '../../components/user-avatar/user-avatar';
import { PageState } from '../../components/page-state/page-state';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

interface DashboardTodo extends Todo {
  kotgroupName: string;
  kotgroupId: string;
}

interface DashboardPost extends Post {
  kotgroupName: string;
  kotgroupId: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, UserAvatar, PageState, TimeAgoPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private http = inject(HttpClient);
  readonly authService = inject(AuthService);

  readonly kotgroepen = signal<Kotgroup[]>([]);
  readonly todos = signal<DashboardTodo[]>([]);
  readonly posts = signal<DashboardPost[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly firstName = computed(
    () => this.authService.userProfile()?.first_name ?? this.authService.userProfile()?.email ?? 'daar',
  );
  readonly avatarUrl = computed(() => this.authService.userProfile()?.avatar_url ?? null);
  readonly firstNameVal = computed(() => this.authService.userProfile()?.first_name ?? '');
  readonly lastNameVal = computed(() => this.authService.userProfile()?.last_name ?? '');
  readonly role = computed(() => this.authService.userRole());

  readonly roleLabel = computed(() => {
    const r = this.role();
    if (r === 'kotbaas') return 'Kotbaas';
    if (r === 'kotgenoot') return 'Kotgenoot';
    if (r === 'admin') return 'Admin';
    return null;
  });

  readonly activeTodos = computed(() =>
    this.todos().filter((t) => t.status === 'todo' || t.status === 'bezig').slice(0, 6),
  );

  readonly openTodoCount = computed(
    () => this.todos().filter((t) => t.status === 'todo' || t.status === 'bezig').length,
  );

  readonly myTodoCount = computed(() => {
    const uid = this.authService.currentUser()?.id;
    if (!uid) return 0;
    return this.todos()
      .filter((t) => t.status === 'todo' || t.status === 'bezig')
      .filter((t) => t.assignees.some((a) => a.id === uid)).length;
  });

  // meest recente posts, gesorteerd op datum
  readonly recentPosts = computed(() =>
    [...this.posts()]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
  );

  constructor() {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<Kotgroup[]>(`${environment.apiUrl}/kotgroepen`)
      .pipe(
        switchMap((kotgroepen) => {
          this.kotgroepen.set(kotgroepen);

          if (kotgroepen.length === 0) {
            return of({ todos: [], posts: [] });
          }

          const todoRequests = kotgroepen.map((kg) =>
            this.http
              .get<Todo[]>(`${environment.apiUrl}/todos?kotgroupId=${kg.id}`)
              .pipe(
                map((todos) =>
                  todos.map((t) => ({ ...t, kotgroupName: kg.name, kotgroupId: kg.id })),
                ),
                catchError(() => of([] as DashboardTodo[])),
              ),
          );

          const postRequests = kotgroepen.map((kg) =>
            this.http
              .get<Post[]>(`${environment.apiUrl}/posts?kotgroupId=${kg.id}`)
              .pipe(
                map((posts) =>
                  posts.map((p) => ({ ...p, kotgroupName: kg.name, kotgroupId: kg.id })),
                ),
                catchError(() => of([] as DashboardPost[])),
              ),
          );

          return forkJoin({
            todos: forkJoin(todoRequests).pipe(map((r) => r.flat())),
            posts: forkJoin(postRequests).pipe(map((r) => r.flat())),
          });
        }),
        catchError((err) => {
          this.error.set(err.error?.error ?? 'Dashboard laden mislukt.');
          return of({ todos: [], posts: [] });
        }),
      )
      .subscribe(({ todos, posts }) => {
        this.todos.set(todos);
        this.posts.set(posts);
        this.loading.set(false);
      });
  }
}
