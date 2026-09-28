// Empêche de taper le signe moins, la notation scientifique ou une virgule/point dans un champ numérique :
// les prix, stocks et durées de l'application sont toujours des nombres entiers positifs.
export function bloquerCaracteresInterdits(event: KeyboardEvent): void {
  if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
    event.preventDefault();
  }
}
