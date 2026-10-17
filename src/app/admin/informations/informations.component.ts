import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';

import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbAccordionDirective, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { Information, InformationForm, InformationService } from 'src/app/theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-informations',
  imports: [ReactiveFormsModule, RouterModule, NgbAccordionModule, TranslatePipe],
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

  // Les horaires d'ouverture hebdomadaires sont geres depuis l'ecran Agenda (voir HorairesOuvertureComponent),
  // pas ici : cette fiche garde l'identite et les coordonnees de l'institut, pas son planning.
  private horairesActuels: Information['horaires'] = [];

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
    sloganEn: ['', Validators.maxLength(255)],
    description: ['', Validators.maxLength(1000)],
    descriptionEn: ['', Validators.maxLength(1000)],
    adresse: ['', Validators.maxLength(255)],
    ville: ['', Validators.maxLength(100)],
    province: ['', Validators.maxLength(100)],
    codePostal: ['', Validators.maxLength(20)],
    pays: ['', Validators.maxLength(100)],
    telephone: ['', Validators.pattern(/^$|^[0-9+()\-. ]{6,30}$/)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    emailsNotification: this.fb.array([] as string[]),
    siteWeb: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    lienInstagram: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    lienFacebook: ['', Validators.pattern(/^$|^https:\/\/\S+$/)],
    bannierePromo: ['', Validators.maxLength(255)],
    fuseauHoraire: ['America/Toronto']
  });

  get emailsNotification(): FormArray {
    return this.form.get('emailsNotification') as FormArray;
  }

  ajouterEmailNotification(): void {
    this.emailsNotification.push(this.fb.control(''));
  }

  retirerEmailNotification(index: number): void {
    this.emailsNotification.removeAt(index);
  }

  ngOnInit(): void {
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
    return Math.round((remplis / this.champsSuivis.length) * 100);
  }

  async submit(): Promise<void> {
    this.saved.set(false);
    this.serverError.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.accordeon?.expandAll();
      this.serverError.set('Certains champs sont invalides.');
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

  private patch(info: Information): void {
    const text = (v: string | null) => v ?? '';
    this.form.patchValue({
      nom: info.nom,
      slogan: text(info.slogan),
      sloganEn: text(info.sloganEn),
      description: text(info.description),
      descriptionEn: text(info.descriptionEn),
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
    this.emailsNotification.clear();
    info.emailsNotification.forEach((e) => this.emailsNotification.push(this.fb.control(e)));
    // Conserves tels quels (geres depuis l'ecran Agenda) et renvoyes inchanges avec le reste de la fiche.
    this.horairesActuels = info.horaires;
    this.form.markAsPristine();
  }

  private payload(): InformationForm {
    const v = this.form.getRawValue();
    const emailsNotification = (v.emailsNotification as string[]).map((e) => e.trim()).filter((e) => e);
    return { ...v, emailsNotification, horaires: this.horairesActuels } as InformationForm;
  }
}
