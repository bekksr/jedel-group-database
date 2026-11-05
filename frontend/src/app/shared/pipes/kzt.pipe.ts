import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'kzt', standalone: true })
export class KztPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) + ' \u20b8';
  }
}
