import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbAccordionDirective, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { Horaire, Information, InformationForm, InformationService, JOURS_SEMAINE } from 'src/app/theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-informations',
  imports: [CommonModule, ReactiveFormsModule, NgbAccordionModule, TranslatePipe],
  templateUrl: './informations.component.html',
  styleUrl: './informations.component.scss'
})
export class InformationsComponent implements OnInit {
  private i18n = inject(TranslationService);
  private fb = inject(FormBuilder);
  private informations = inject(InformationService);
  private confirmation = inject(ConfirmationService);

  // Deplie toutes les sections si l'enregistrement echoue, pour qu'un champ en erreur ne reste jamais caché.
  @ViewChild('accordeon') private accordeon?: NgbAccordionDirective;

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
          plages: this.fb.array([])
        })
      )
    )
  });

  get horaires(): FormArray {
    return this.form.get('horaires') as FormArray;
  }

  plages(jourIndex: number): FormArray {
    return this.horaires.at(jourIndex).get('plages') as FormArray;
  }

  private nouvellePlage(heureDebut = '', heureFin = ''): FormGroup {
    return this.fb.group({ heureDebut: [heureDebut], heureFin: [heureFin] });
  }

  ajouterPlage(jourIndex: number): void {
    this.plages(jourIndex).push(this.nouvellePlage());
  }

  retirerPlage(jourIndex: number, plageIndex: number): void {
    this.plages(jourIndex).removeAt(plageIndex);
  }

  ngOnInit(): void {
    this.horaires.controls.forEach((row, i) => {
      row.get('ouvert')?.valueChanges.subscribe((open) => this.toggleJour(i, !!open));
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

  // Pourcentage de champs renseignes (hors "Fuseau horaire", deja rempli par defaut) : donne une idee
  // visuelle de ce qu'il reste a completer sur la fiche de l'institut, tout en restant simple (aucun champ
  // n'est obligatoire a part le nom : ce compteur guide sans jamais bloquer l'enregistrement).
  private readonly champsSuivis = [
    'nom',
    'slogan',
    'description',
    'adresse',
    'ville',
    'province',
    'codePostal',
    'telephone',
    'email',
    'siteWeb',
    'lienInstagram',
    'lienFacebook',
    'bannierePromo'
  ];

  tauxRemplissage(): number {
    const v = this.form.getRawValue();
    const remplis = this.champsSuivis.filter((c) => !!(v as Record<string, string>)[c]?.toString().trim()).length;
    const horaireOuvert = this.horaires.controls.some((row) => row.get('ouvert')?.value) ? 1 : 0;
    const total = this.champsSuivis.length + 1;
    return Math.round(((remplis + horaireOuvert) / total) * 100);
  }

  async submit(): Promise<void> {
    this.saved.set(false);
    this.serverError.set('');
    this.form.markAllAsTouched();

    const invalidTimes = this.horaires.controls.some((row) => {
      const v = row.getRawValue();
      if (!v.ouvert) return false;
      const plages: { heureDebut: string; heureFin: string }[] = v.plages;
      if (!plages.length) return true;
      return plages.some((p, i) => {
        if (!p.heureDebut || !p.heureFin || p.heureDebut >= p.heureFin) return true;
        // Les plages doivent être dans l'ordre et ne pas se chevaucher (ex. 9h-15h puis 16h-18h).
        return i > 0 && plages[i - 1].heureFin > p.heureDebut;
      });
    });
    if (this.form.invalid || invalidTimes) {
      this.accordeon?.expandAll();
      this.serverError.set(
        invalidTimes
          ? this.i18n.t('ts.info.horaires')
          : 'Certains champs sont invalides.'
      );
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.info.confirmerTitre'),
      message: this.i18n.t('ts.info.confirmerMsg'),
      texteConfirmer: this.i18n.t('ts.enregistrer'),
      icone: 'ti-device-floppy'
    });
    if (!ok) return;

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
            ? this.i18n.t('ts.info.refuse')
            : (err?.error?.message ?? this.i18n.t('ts.info.erreur'))
        );
      }
    });
  }

  // À l'ouverture d'un jour sans aucune plage, on en propose une vide tout de suite ; à la fermeture, on les retire.
  private toggleJour(jourIndex: number, open: boolean): void {
    const plages = this.plages(jourIndex);
    if (open) {
      if (!plages.length) plages.push(this.nouvellePlage());
    } else {
      plages.clear();
    }
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
      const jourIndex = h.jourSemaine - 1;
      const row = this.horaires.at(jourIndex) as FormGroup;
      row.patchValue({ ouvert: h.ouvert });
      const plages = this.plages(jourIndex);
      plages.clear();
      h.plages.forEach((p) => plages.push(this.nouvellePlage(p.heureDebut, p.heureFin)));
      if (h.ouvert && !plages.length) plages.push(this.nouvellePlage());
    });
    this.form.markAsPristine();
  }

  private payload(): InformationForm {
    const v = this.form.getRawValue();
    const horaires: Horaire[] = this.horaires.controls.map((row) => {
      const r = row.getRawValue();
      const plages = r.ouvert ? (r.plages as { heureDebut: string; heureFin: string }[]) : [];
      return {
        jourSemaine: r.jourSemaine,
        ouvert: !!r.ouvert && plages.length > 0,
        plages
      };
    });
    return { ...v, horaires } as InformationForm;
  }
}
