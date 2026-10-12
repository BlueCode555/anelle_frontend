import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  // Le backend est servi sous le meme domaine, chemin /app (reverse proxy Nginx) : voir scripts/nginx.
  apiUrl: '/app',
  keycloak: { url: 'https://auth.arnelle-institut.com', realm: 'anelle', clientId: 'anelle-front' }
};
