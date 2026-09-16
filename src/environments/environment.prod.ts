import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  // TODO: replace with the deployed anelle backend URL
  apiUrl: '/app'
};
