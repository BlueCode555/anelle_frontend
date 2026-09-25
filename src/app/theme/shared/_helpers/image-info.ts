// Largeur (en pixels) d'une image choisie, lue dans le navigateur avant l'envoi.
export function largeurImage(fichier: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(Number.MAX_SAFE_INTEGER);
    };
    img.src = url;
  });
}
