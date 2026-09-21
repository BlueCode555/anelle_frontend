// Outils PKCE pour la connexion du personnel (flux "code d'autorisation" de Keycloak, sans secret cote navigateur).

function base64Url(octets: Uint8Array): string {
  let texte = '';
  octets.forEach((o) => (texte += String.fromCharCode(o)));
  return btoa(texte).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function chaineAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return base64Url(octets).slice(0, longueur);
}

export async function defiPkce(verifier: string): Promise<string> {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(empreinte));
}
