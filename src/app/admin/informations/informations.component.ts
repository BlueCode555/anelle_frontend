import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Horaire, Information, InformationService, JOURS_SEMAINE } from 'src/app/theme/shared/service/information.service';

@Component({
  selector: 'app-informations',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './informations.component.html',
  styleUrl: './informations.component.scss'
})
export class InformationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private informations = inject(InformationService);

  readonly jours = JOURS_SEMAINE;

  // Fuseaux du Canada : les horaires d'ouverture et les creneaux de rendez-vous sont calcules dans ce fuseau.
  readonly fuseaux = [
    { id: 'America/St_Johns', libelle: 'Terre-Neuve (Saint-Jean)' },
    { id: 'America/Halifax', libelle: 'Atlantique (Halifax)' },
    { id: 'America/Toronto', libelle: 'Est (Toronto, Montréal, Ottawa)' },
    { id: 'America/Winnipeg', libelle: 'Centre (Winnipeg)' },
    { id: 'America/Regina', libelle: 'Saskatchewan (Regina)' },
    { id: 'America/Edmonton', libelle: 'Montagnes (Edmonton, Calgary)' },
    { id: 'America/Vancouver', libelle: 'Pacifique (Vancouver)' }
  ];

  loading = signal(true);
  loadError = signal(false);
  saving = signal(false);
  saved = signal(false);
  serverError = signal('');

  form: FormGroup = this.fb.group({
    nom: ['', [Validators.required, Validators.maxLength(150)]],
    slogan: ['', Validators.maxLength(255)],
    description: ['', Validators.maxLength(1000)],
    adresse: ['', Validators.maxLength(255)],
    ville: ['', Validators.maxLength(100)],
    province: ['', Validators.maxLength(100)],
    codePostal: ['', Validators.maxLength(20)],
    pays: ['', Validators.maxLength(100)],
    telephone: ['', Validators.pattern(/^$|^[0-9+()\-. ]{6,30}$/)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    siteWeb: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    lienInstagram: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    lienFacebook: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    bannierePromo: ['', Validators.maxLength(255)],
    fuseauHoraire: ['America/Toronto'],
    horaires: this.fb.array(
      this.jours.map((_, i) =>
        this.fb.group({
          jourSemaine: [i + 1],
          ouvert: [false],
          heureDebut: [{ value: '', disabled: true }],
          heureFin: [{ value: '', disabled: true }]
        })
      )
    )
  });

  get horaires(): FormArray {
    return this.form.get('horaires') as FormArray;
  }

  ngOnInit(): void {
    this.horaires.controls.forEach((row) => {
      row.get('ouvert')?.valueChanges.subscribe((open) => this.toggleTimes(row as FormGroup, !!open));
    });

    this.informations.fetch().subscribe({
      next: (info) => {
        this.patch(info);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  hasError(control: string, error: string): boolean {
    const c = this.form.get(control);
    return !!c && c.touched && c.hasError(error);
  }

  submit(): void {
    this.saved.set(false);
    this.serverError.set('');
    this.form.markAllAsTouched();

    const invalidTimes = this.horaires.controls.some((row) => {
      const v = row.getRawValue();
      return v.ouvert && (!v.heureDebut || !v.heureFin || v.heureDebut >= v.heureFin);
    });
    if (this.form.invalid || invalidTimes) {
      this.serverError.set(
        invalidTimes
          ? "Vérifiez les horaires : un jour ouvert doit avoir une heure d'ouverture précédant l'heure de fermeture."
          : 'Certains champs sont invalides.'
      );
      return;
    }

    this.saving.set(true);
    this.informations.update(this.payload()).subscribe({
      next: (info) => {
        this.patch(info);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(
          err?.status === 401 || err?.status === 403
            ? "Enregistrement refusé : seule l'esthéticienne connectée peut modifier ces informations."
            : (err?.error?.message ?? "Une erreur est survenue lors de l'enregistrement.")
        );
      }
    });
  }

  private toggleTimes(row: FormGroup, open: boolean): void {
    ['heureDebut', 'heureFin'].forEach((name) => (open ? row.get(name)?.enable() : row.get(name)?.disable()));
  }

  private patch(info: Information): void {
    const text = (v: string | null) => v ?? '';
    this.form.patchValue({
      nom: info.nom,
      slogan: text(info.slogan),
      description: text(info.description),
      adresse: text(info.adresse),
      ville: text(info.ville),
      province: text(info.province),
      codePostal: text(info.codePostal),
      pays: text(info.pays),
      telephone: text(info.telephone),
      email: text(info.email),
      siteWeb: text(info.siteWeb),
      lienInstagram: text(info.lienInstagram),
      lienFacebook: text(info.lienFacebook),
      bannierePromo: text(info.bannierePromo),
      fuseauHoraire: info.fuseauHoraire ?? 'America/Toronto'
    });
    info.horaires.forEach((h) => {
      const row = this.horaires.at(h.jourSemaine - 1) as FormGroup;
      row.patchValue({ ouvert: h.ouvert, heureDebut: h.heureDebut ?? '', heureFin: h.heureFin ?? '' });
      this.toggleTimes(row, h.ouvert);
    });
    this.form.markAsPristine();
  }

  private payload(): Information {
    const v = this.form.getRawValue();
    const horaires: Horaire[] = this.horaires.controls.map((row) => {
      const r = row.getRawValue();
      return {
        jourSemaine: r.jourSemaine,
        ouvert: !!r.ouvert,
        heureDebut: r.ouvert ? r.heureDebut : null,
        heureFin: r.ouvert ? r.heureFin : null
      };
    });
    return { ...v, horaires } as Information;
  }
}
