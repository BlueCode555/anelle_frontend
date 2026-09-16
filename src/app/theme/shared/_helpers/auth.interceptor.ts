import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'access_token';

// Attaches the Keycloak/JWT bearer token to every request going to the anelle API.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    })
  );
};
