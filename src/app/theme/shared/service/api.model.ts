// Mirrors bj.anelle.anelle_backend.dto.response.ApiResponse<T> / PageResponse<T>
// and bj.anelle.anelle_backend.specs.{PaginationCriteria,FilterCriteria}.

export interface ApiError {
  field?: string;
  message: string;
}

export interface ApiResponse<T> {
  timestamp: string;
  success: boolean;
  message: string;
  data: T;
  path: string;
  errors?: ApiError[];
  errorCode?: number;
}

export interface MetaResponse {
  totalPages: number;
  numberOfElements: number;
  totalElements: number;
  size: number;
  pageNumber: number;
  hasPrev: boolean;
  hasNext: boolean;
  isLast: boolean;
  isFirst: boolean;
}

export interface PageResponse<T> {
  content: T[];
  meta: MetaResponse;
}

export interface PaginationCriteria {
  page?: number;
  size?: number;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
  filter?: string;
}

export interface FilterCriteria {
  field: string;
  condition: string;
  value: unknown;
}
