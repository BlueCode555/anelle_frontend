import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse, FilterCriteria, PageResponse, PaginationCriteria } from './api.model';

// Generic REST client matching bj.anelle.anelle_backend.controllers.MasterController<E, R, F>.
// Usage: build a resource-specific service extending or wrapping this with `resource = 'clients'`.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  list<T>(resource: string, criteria: PaginationCriteria = {}): Observable<PageResponse<T>> {
    let params = new HttpParams();
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<ApiResponse<PageResponse<T>>>(`${this.baseUrl}/${resource}`, { params }).pipe(map((res) => res.data));
  }

  findOne<T>(resource: string, identifier: string | number): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}/${resource}/${identifier}`).pipe(map((res) => res.data));
  }

  create<T>(resource: string, form: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}/${resource}`, form).pipe(map((res) => res.data));
  }

  update<T>(resource: string, id: number, form: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}/${resource}/${id}`, form).pipe(map((res) => res.data));
  }

  delete(resource: string, id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/${resource}/${id}`).pipe(map((res) => res.data));
  }

  massDelete(resource: string, ids: number[]): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/${resource}/delete`, { ids }).pipe(map((res) => res.data));
  }

  filter<T>(resource: string, filters: FilterCriteria[], criteria: PaginationCriteria = {}): Observable<PageResponse<T>> {
    let params = new HttpParams();
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    });

    return this.http
      .post<ApiResponse<PageResponse<T>>>(`${this.baseUrl}/${resource}/filter`, filters, { params })
      .pipe(map((res) => res.data));
  }
}
