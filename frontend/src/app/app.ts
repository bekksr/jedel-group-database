import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppShell } from './core/layout/app-shell';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppShell],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
