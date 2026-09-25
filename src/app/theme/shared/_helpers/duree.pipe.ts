import { Pipe, PipeTransform } from '@angular/core';

// 45 -> "45 min", 90 -> "1 h 30", 120 -> "2 h" (identique en francais et en anglais).
@Pipe({ name: 'duree', standalone: true })
export class DureePipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return m + ' min';
    return m === 0 ? h + ' h' : h + ' h ' + String(m).padStart(2, '0');
  }
}
