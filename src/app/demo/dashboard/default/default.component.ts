// Angular Import
import { Component } from '@angular/core';

// project import
import { SHARED_IMPORTS } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-default',
  imports: [...SHARED_IMPORTS],
  templateUrl: './default.component.html',
  styleUrl: './default.component.scss'
})
export class DefaultComponent {}
