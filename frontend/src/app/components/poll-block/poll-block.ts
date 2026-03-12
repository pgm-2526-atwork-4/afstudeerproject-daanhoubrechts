import { Component, input, output } from '@angular/core';

import { Post } from '../../models/post.interface';

@Component({
  selector: 'app-poll-block',
  imports: [],
  templateUrl: './poll-block.html',
  styleUrl: './poll-block.scss',
})
export class PollBlock {
  readonly post = input.required<Post>();
  readonly vote = output<string>();

  getPollTotal(): number {
    return this.post().poll_options.reduce((sum, o) => sum + o.vote_count, 0);
  }

  getPollPercentage(optionId: string): number {
    const total = this.getPollTotal();
    if (!total) return 0;
    const option = this.post().poll_options.find((o) => o.id === optionId);
    return Math.round(((option?.vote_count ?? 0) / total) * 100);
  }
}
