import { Component, input } from '@angular/core';
import { IssueStatus, IssuePriority } from '../../models/issue.interface';

@Component({
  selector: 'app-issue-status-badge',
  standalone: true,
  imports: [],
  templateUrl: './issue-status-badge.html',
  styleUrl: './issue-status-badge.scss',
})
export class IssueStatusBadge {
  readonly status = input<IssueStatus | null>(null);
  readonly priority = input<IssuePriority | null>(null);

  readonly statusLabels: Record<IssueStatus, string> = {
    open: 'Open',
    in_progress: 'In behandeling',
    resolved: 'Opgelost',
    closed: 'Gesloten',
  };

  readonly priorityLabels: Record<IssuePriority, string> = {
    low: 'Laag',
    medium: 'Medium',
    high: 'Hoog',
    urgent: 'Urgent',
  };
}
