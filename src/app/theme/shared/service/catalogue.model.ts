// Mirrors bj.anelle.anelle_backend.dto.response.{CategorieResponse,ServiceResponse}.

export interface CategorieResponse {
  id: number;
  code: string;
  libelle: string;
  description?: string;
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
}

// Mirrors bj.anelle.anelle_backend.dto.request.{CategorieForm,ServiceForm}.

export interface CategorieForm {
  code: string;
  libelle: string;
  description: string;
}

export interface ServiceForm {
  code: string;
  nomService: string;
  categorieCode: string;
  description: string;
  dureeMinutes: number | null;
  tarif: number | null;
  actif: boolean;
}
