import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
