// Mirrors bj.anelle.anelle_backend.dto.response.{CategorieResponse,ServiceResponse}.

export interface CategorieResponse {
  id: number;
  code: string;
  libelle: string;
  description?: string;
  imageUrl?: string | null;
  // Affichee sur la page d'accueil (absent sur un ancien serveur = affichee)
  actif?: boolean;
}

export interface ServiceResponse {
  id: number;
  code: string;
  nomService: string;
  categorieCode: string;
  categorieLibelle: string;
  description?: string;
  dureeMinutes: number;
  tarif: number;
  actif: boolean;
  imageUrl?: string | null;
}

// Mirrors bj.anelle.anelle_backend.dto.request.{CategorieForm,ServiceForm}.

export interface CategorieForm {
  libelle: string;
  description: string;
  imageUrl: string;
  actif: boolean;
}

export interface ServiceForm {
  nomService: string;
  categorieCode: string;
  description: string;
  dureeMinutes: number | null;
  tarif: number | null;
  actif: boolean;
  imageUrl: string;
}
