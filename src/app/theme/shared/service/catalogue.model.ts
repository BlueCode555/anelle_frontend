// Mirrors bj.anelle.anelle_backend.dto.response.{CategorieResponse,ServiceResponse}.

export interface CategorieResponse {
  id: number;
  code: string;
  libelle: string;
  // Version anglaise ; vide = on retombe sur `libelle` meme en anglais.
  libelleEn?: string | null;
  description?: string;
  imageUrl?: string | null;
  // Affichee sur la page d'accueil (absent sur un ancien serveur = affichee)
  actif?: boolean;
}

export interface ServiceResponse {
  id: number;
  code: string;
  nomService: string;
  // Version anglaise ; vide = on retombe sur `nomService` meme en anglais.
  nomServiceEn?: string | null;
  categorieCode: string;
  categorieLibelle: string;
  categorieLibelleEn?: string | null;
  description?: string;
  dureeMinutes: number;
  tarif: number;
  actif: boolean;
  imageUrl?: string | null;
}

// Mirrors bj.anelle.anelle_backend.dto.request.{CategorieForm,ServiceForm}.

export interface CategorieForm {
  libelle: string;
  libelleEn: string;
  description: string;
  imageUrl: string;
  actif: boolean;
}

export interface ServiceForm {
  nomService: string;
  nomServiceEn: string;
  categorieCode: string;
  description: string;
  dureeMinutes: number | null;
  tarif: number | null;
  actif: boolean;
  imageUrl: string;
}
