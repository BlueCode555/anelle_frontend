---
name: motion-design
description: Motion design « vibe » d'Arnelle Institut (Angular 22, SCSS) — animations d'entrée, révélations au scroll, micro-interactions, transitions de pages, états de chargement, toasts, modales. À utiliser dès qu'on demande d'animer, de rendre « plus vivant », « plus fluide », « plus premium », d'ajouter des transitions ou effets, ou de retoucher une animation existante, côté site public ou back-office.
---

# Motion design — Arnelle Institut

## L'intention (la « vibe »)

Un institut de beauté haut de gamme : **calme, doux, soyeux, sûr de lui**. Le mouvement évoque un geste de soin — une main qui se pose, un tissu qui glisse, la lumière dorée qui se lève. Jamais nerveux, jamais rebondissant, jamais « tech ».

- **Lent à l'entrée, rapide à la sortie.** Ce qui apparaît prend son temps ; ce qui disparaît s'efface vite.
- **Petites distances.** On glisse de 8 à 24 px, on zoome de 0,96 à 1. Pas de grands déplacements.
- **Le doré est un accent.** Un reflet, un liseré qui se dessine, une lueur au survol — pas un feu d'artifice.
- **Une seule chose bouge à la fois** dans le champ de vision ; le reste suit en cascade (stagger).
- **Le mouvement sert le sens** : il montre d'où vient un élément, ce qui a changé, ce qui est cliquable. Si une animation n'apporte rien, on ne la met pas.

## Deux registres

| | Site public (`src/app/public/`) | Back-office (`src/app/admin/`, `theme/layout/admin`) |
|---|---|---|
| Ton | Expressif, éditorial, « magazine » | Sobre, efficace, outil de travail |
| Durées | 400–900 ms pour les entrées | 120–250 ms maximum |
| Scroll reveal | Oui (sections, cartes, images) | Non |
| Effets décoratifs | Ken Burns, reflets dorés, parallax léger | Aucun |
| Ce qui s'anime | Hero, sections, cartes produits/services, panier, réservation | Feedback (toasts, sauvegarde), ouverture de lignes/détails, modales, menus |

Dans le back-office, une animation ne doit **jamais** retarder une action de l'esthéticienne.

## Tokens (source unique)

Toutes les animations utilisent ces variables. Si `src/scss/motion.scss` n'existe pas encore, le créer avec ce contenu et l'importer juste après `brand.scss` dans `src/styles.scss` :

```scss
// Mouvement Arnelle Institut : durées, courbes et animations partagées.
:root {
  // Durées
  --ar-duree-instant: 120ms;  // retour de clic, survol
  --ar-duree-rapide: 200ms;   // sorties, menus, back-office
  --ar-duree-douce: 400ms;    // entrées de composants
  --ar-duree-lente: 700ms;    // sections, hero, images
  --ar-duree-scene: 1200ms;   // première apparition de page (site public)

  // Courbes
  --ar-courbe-soie: cubic-bezier(0.22, 1, 0.36, 1);      // entrées : démarre vite, se pose en douceur
  --ar-courbe-sortie: cubic-bezier(0.4, 0, 1, 1);        // sorties : accélère et part
  --ar-courbe-standard: cubic-bezier(0.4, 0, 0.2, 1);    // changements d'état
  --ar-courbe-respiration: cubic-bezier(0.45, 0, 0.55, 1); // boucles (loader, pulsation)

  // Cascade
  --ar-cascade: 70ms;
}

@keyframes ar-apparaitre {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ar-fondu {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ar-eclore {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: none; }
}
@keyframes ar-disparaitre {
  to { opacity: 0; transform: translateY(8px); }
}
@keyframes ar-reflet-dore {
  from { background-position: -150% 0; }
  to   { background-position: 250% 0; }
}

.ar-entree   { animation: ar-apparaitre var(--ar-duree-douce) var(--ar-courbe-soie) both; }
.ar-eclosion { animation: ar-eclore var(--ar-duree-douce) var(--ar-courbe-soie) both; }
.ar-sortie   { animation: ar-disparaitre var(--ar-duree-rapide) var(--ar-courbe-sortie) both; }

// Cascade : style="--i: 3" sur chaque enfant
.ar-cascade > * {
  animation: ar-apparaitre var(--ar-duree-douce) var(--ar-courbe-soie) both;
  animation-delay: calc(var(--i, 0) * var(--ar-cascade));
}

// Révélation au scroll (pilotée par la directive arReveal)
.ar-reveal { opacity: 0; transform: translateY(24px); }
.ar-reveal.ar-visible {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--ar-duree-lente) var(--ar-courbe-soie),
    transform var(--ar-duree-lente) var(--ar-courbe-soie);
  transition-delay: calc(var(--i, 0) * var(--ar-cascade));
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .ar-reveal { opacity: 1; transform: none; }
}
```

Plusieurs composants redéfinissent déjà leurs propres `@keyframes entree` / `pop` (home, boutique, reserver, mon-espace, connexion, admin…). Quand on touche à l'un d'eux, **migrer vers les tokens et classes partagés** plutôt que d'ajouter un énième keyframe local. Ne pas tout migrer d'un coup sans qu'on le demande.

## Outils Angular (pas de `@angular/animations`)

Le projet n'a **pas** `@angular/animations` : ne pas l'ajouter. Utiliser les API natives d'Angular 22 et le CSS.

**Entrée / sortie d'un élément (`@if`, `@for`)**
```html
@if (ligneOuverte() === entree) {
  <tr class="detail" animate.enter="ar-entree" animate.leave="ar-sortie">…</tr>
}
```
Angular retire l'élément du DOM à la fin de l'animation `animate.leave`.

**Transitions de pages (View Transitions)** — dans `provideRouter(routes, withViewTransitions())`, puis en global :
```scss
::view-transition-old(root) { animation: ar-disparaitre var(--ar-duree-rapide) var(--ar-courbe-sortie) both; }
::view-transition-new(root) { animation: ar-apparaitre var(--ar-duree-douce) var(--ar-courbe-soie) both; }
```
Pour faire « voyager » un élément d'une page à l'autre (ex. photo produit liste → fiche), lui donner le même `view-transition-name` unique des deux côtés.

**Révélation au scroll** — directive partagée dans `src/app/theme/shared/directives/reveal.directive.ts` (la créer si absente) :
```ts
import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

// Ajoute .ar-visible quand l'élément entre dans l'écran (une seule fois). Voir .ar-reveal dans motion.scss.
@Directive({ selector: '[arReveal]', host: { class: 'ar-reveal' } })
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.classList.add('ar-visible');
      return;
    }
    this.observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          this.el.nativeElement.classList.add('ar-visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
```
Usage : `<article arReveal [style.--i]="$index">`.

## Recettes « vibe Arnelle »

- **Titre de hero** : les mots apparaissent l'un après l'autre (spans + `--i`), `ar-apparaitre` en `--ar-duree-lente`, puis un liseré doré se dessine dessous (`transform: scaleX(0 → 1)`, `transform-origin: left`).
- **Carte produit / service au survol** : `translateY(-4px)` + passage de `--ar-ombre` à `--ar-ombre-forte` + image `scale(1.04)` dans un conteneur `overflow: hidden`. Durée `--ar-duree-douce`.
- **Reflet doré** sur un bouton principal ou un badge : `linear-gradient(110deg, transparent 40%, rgba(232,200,116,.45) 50%, transparent 60%)` en `background-size: 200% 100%`, animation `ar-reflet-dore` 1,2 s, déclenchée au survol ou une seule fois à l'apparition. Jamais en boucle infinie.
- **Ajout au panier** : la pastille du compteur fait `ar-eclore` + une brève lueur dorée. Pas de vol d'image à travers l'écran.
- **Créneau choisi (slot-picker)** : le fond doré « s'étale » depuis le centre (`scale` d'un pseudo-élément), `--ar-duree-rapide`.
- **Chargement** : squelettes crème/nude avec reflet lent (1,6 s, `--ar-courbe-respiration`) plutôt que des spinners, dès que la forme du contenu est connue.
- **Toasts / messages** : entrée `ar-apparaitre` depuis le bas, sortie `ar-sortie`. Erreurs : pas de tremblement (shake) ; on met en avant par la couleur et un léger `ar-eclore`.
- **Back-office** : ouverture d'une ligne de détail (journal d'audit, commandes) en `animate.enter="ar-entree"` avec `--ar-duree-rapide` ; modales en `ar-eclosion`. Rien d'autre.

## Règles techniques

1. **Animer uniquement `transform` et `opacity`** (et `clip-path`/`filter` avec parcimonie). Jamais `width`, `height`, `top`, `left`, `margin` — sauf ouverture d'accordéon avec `grid-template-rows: 0fr → 1fr`.
2. **`prefers-reduced-motion` toujours respecté** : le bloc global de `motion.scss` le gère pour le CSS ; en TS (vidéo, parallax, autoplay), tester `matchMedia('(prefers-reduced-motion: reduce)')` comme le fait déjà `home.component.ts`.
3. **Pas de boucle infinie décorative** hors loader. Rien qui clignote.
4. **`will-change` seulement pendant l'animation**, jamais posé en permanence sur de nombreux éléments.
5. **Mobile d'abord** : pas de parallax ni d'effets au survol indispensables sur écran tactile ; tester à 375 px.
6. **Le thème sombre** (bouton lune du back-office) : les lueurs dorées restent visibles mais plus discrètes ; vérifier les deux thèmes.
7. **Ne jamais bloquer une interaction** : un élément animé reste cliquable pendant son entrée ; pas de délai avant qu'un formulaire soit utilisable.
8. Commentaires de code **en français**, comme le reste du projet.

## Méthode quand on demande une animation

1. Identifier le registre (public ou back-office) et ce que l'animation doit **signifier**.
2. Vérifier que `motion.scss` et `RevealDirective` existent ; les créer sinon (contenus ci-dessus).
3. Réutiliser une classe/recette existante avant d'en inventer une. Toute nouvelle courbe ou durée devient un token.
4. Implémenter, puis vérifier : `npx ng build` sans erreur, rendu à 375 px et en bureau, thème clair et sombre, et avec « réduire les animations » activé dans le système.
5. Résumer à l'utilisateur ce qui bouge, où, et comment le désactiver ou l'ajuster (quel token modifier).
