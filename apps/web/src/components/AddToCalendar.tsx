import { useState } from 'react';
import { Button } from '@/components/ui';
import { Sheet } from '@/components/layout';
import { IconCalendar } from '@/components/icons';
import { useT } from '@/i18n';

/**
 * Bouton "Ajouter au calendrier" pour un depart.
 *
 * Deux voies, cote client uniquement (aucune donnee envoyee) :
 *  - Google Agenda : lien pre-rempli ouvert dans un nouvel onglet.
 *  - Apple / autres : fichier .ics telecharge (Apple Calendar, Outlook...).
 *
 * Les heures sont "flottantes" (interpretees dans le fuseau de l appareil) ;
 * pour Google on precise Africa/Casablanca. Un rappel (VALARM) 2 h avant est
 * inclus dans le .ics. Fonctionnalite ISOLEE : un fichier + ses usages.
 */
export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  location: string;
  details: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> "AAAAMMJJTHHMMSS" (heure locale flottante). */
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function googleUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    location: e.location,
    details: e.details,
    ctz: 'Africa/Casablanca',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function icsContent(e: CalendarEvent): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reservation Membres//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${stamp(e.start)}-${Math.random().toString(36).slice(2)}@golf`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.details)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel départ golf',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function AddToCalendar(event: CalendarEvent) {
  const t = useT();
  const [open, setOpen] = useState(false);

  function google(): void {
    window.open(googleUrl(event), '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  function apple(): void {
    const blob = new Blob([icsContent(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'depart-golf.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        full
        icon={<IconCalendar width={18} height={18} />}
        onClick={() => setOpen(true)}
      >
        {t('cal.add')}
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('cal.add')}>
        <div className="flex flex-col gap-3">
          <Button full size="lg" onClick={google}>{t('cal.google')}</Button>
          <Button variant="outline" full size="lg" onClick={apple}>{t('cal.apple')}</Button>
          <p className="text-center text-xs text-[var(--color-ink-faint)]">
            {t('cal.reminderHint')}
          </p>
        </div>
      </Sheet>
    </>
  );
}
