// Dates et heures dans le fuseau horaire de l'institut (et non celui du navigateur) :
// un rendez-vous a 10 h a Toronto s'affiche 10 h partout.

// Suit la langue choisie (TranslationService la reporte sur <html lang>).
export function localeCourante(): string {
  return document.documentElement.lang === 'en' ? 'en-CA' : 'fr-CA';
}

export function formatHeure(iso: string, zone: string): string {
  return new Intl.DateTimeFormat(localeCourante(), { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function formatJour(iso: string, zone: string): string {
  return new Intl.DateTimeFormat(localeCourante(), { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso)
  );
}

export function formatJourCourt(iso: string, zone: string): string {
  return new Intl.DateTimeFormat(localeCourante(), { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
}

// "AAAA-MM-JJ" du jour de l'instant dans le fuseau donne ; sert a regrouper par jour et a borner les calendriers.
export function cleJour(iso: string | Date, zone: string): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function aujourdhui(zone: string): string {
  return cleJour(new Date(), zone);
}

export function ajouterJours(cle: string, jours: number): string {
  const [y, m, d] = cle.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + jours));
  return date.toISOString().slice(0, 10);
}

// Lundi de la semaine qui contient le jour donne ("AAAA-MM-JJ").
export function lundiDeLaSemaine(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  const jour = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche
  return ajouterJours(cle, jour === 0 ? -6 : 1 - jour);
}

function decalageMinutes(instantMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(instantMs));
  const valeur = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const enUtc = Date.UTC(valeur('year'), valeur('month') - 1, valeur('day'), valeur('hour'), valeur('minute'), valeur('second'));
  return Math.round((enUtc - instantMs) / 60000);
}

// "2026-09-22T09:30" saisi dans un champ datetime-local, lu comme heure murale du fuseau de l'institut
// -> "2026-09-22T09:30:00-04:00", le format attendu par l'API.
export function versIsoAvecDecalage(local: string, zone: string): string {
  const [jour, heure] = local.split('T');
  const [y, mo, d] = jour.split('-').map(Number);
  const [h, mi] = heure.split(':').map(Number);
  const estimation = Date.UTC(y, mo - 1, d, h, mi);
  let decalage = decalageMinutes(estimation, zone);
  decalage = decalageMinutes(estimation - decalage * 60000, zone);
  const signe = decalage >= 0 ? '+' : '-';
  const abs = Math.abs(decalage);
  return `${jour}T${heure}:00${signe}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
