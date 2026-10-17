import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';

import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbAccordionDirective, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { Horaire, Information, InformationService, JOURS_SEMAINE } from 'src/app/theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

// Horaires d'ouverture hebdomadaires : deplaces depuis "Mon institut" vers l'Agenda, puisque c'est l'ecran que
// l'equipe consulte au quotidien (une collaboratrice cherchait les horaires dans Agenda et ne les trouvait pas
// sur l'autre ecran). Reglee une fois, cette grille se repete chaque semaine et determine les creneaux proposes
// aux clientes. Le reste de la fiche institut (nom, coordonnees...) reste sur l'ecran "Mon institut".
@Component({
  selector: 'app-horaires-ouverture',
  imports: [ReactiveFormsModule, NgbAccordionModule, TranslatePipe],
  templateUrl: './horaires-ouverture.component.html',
  styleUrl: './horaires-ouverture.component.scss'
})
export class HorairesOuvertureComponent implements OnInit {
  private i18n = inject(TranslationService);
  private fb = inject(FormBuilder);
  private informations = inject(InformationService);
  private confirmation = inject(ConfirmationService);

  @ViewChild('accordeon') private accordeon?: NgbAccordionDirective;

  readonly jours = JOURS_SEMAINE;

  loading = signal(true);
  loadError = signal(false);
  saving = signal(false);
  saved = signal(false);
  serverError = signal('');

  // Le reste de la fiche institut (nom, coordonnees...) est conserve tel quel et renvoye avec les horaires :
  // l'API d'enregistrement attend l'objet complet.
  private infoActuelle: Information | null = null;

  horaires: FormArray = this.fb.array(
    this.jours.map((_, i) =>
      this.fb.group({
        jourSemaine: [i + 1],
        ouvert: [false],
        plages: this.fb.array([])
      })
    )
  );

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

  async submit(): Promise<void> {
    this.saved.set(false);
    this.serverError.set('');

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
    if (invalidTimes) {
      this.accordeon?.expandAll();
      this.serverError.set(this.i18n.t('ts.info.horaires'));
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.info.confirmerTitre'),
      message: this.i18n.t('ts.info.confirmerMsg'),
      texteConfirmer: this.i18n.t('ts.enregistrer'),
      icone: 'ti-device-floppy'
    });
    if (!ok || !this.infoActuelle) return;

    this.saving.set(true);
    this.informations.update({ ...this.infoActuelle, horaires: this.payload() }).subscribe({
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
    this.infoActuelle = info;
    info.horaires.forEach((h) => {
      const jourIndex = h.jourSemaine - 1;
      const row = this.horaires.at(jourIndex) as FormGroup;
      row.patchValue({ ouvert: h.ouvert });
      const plages = this.plages(jourIndex);
      plages.clear();
      h.plages.forEach((p) => plages.push(this.nouvellePlage(p.heureDebut, p.heureFin)));
      if (h.ouvert && !plages.length) plages.push(this.nouvellePlage());
    });
  }

  private payload(): Horaire[] {
    return this.horaires.controls.map((row) => {
      const r = row.getRawValue();
      const plages = r.ouvert ? (r.plages as { heureDebut: string; heureFin: string }[]) : [];
      return { jourSemaine: r.jourSemaine, ouvert: !!r.ouvert && plages.length > 0, plages };
    });
  }
}
