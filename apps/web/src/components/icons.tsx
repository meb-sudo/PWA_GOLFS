import type { SVGProps } from 'react';

/**
 * Jeu d icones au trait, dessinees a la meme grille 24 et au meme
 * poids de trait pour rester coherentes en barre de navigation.
 */
type Props = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      width="24" height="24" aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: Props) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" /></Svg>
);
export const IconCalendar = (p: Props) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></Svg>
);
export const IconFlag = (p: Props) => (
  <Svg {...p}><path d="M6 21V4" /><path d="M6 4.5h10.5l-2.2 3.6 2.2 3.6H6" /></Svg>
);
export const IconNews = (p: Props) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M7 9h7M7 12.5h10M7 16h6" /></Svg>
);
export const IconMenu = (p: Props) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);
export const IconPlus = (p: Props) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconUser = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4" /></Svg>
);
export const IconClock = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></Svg>
);
export const IconChevron = (p: Props) => (
  <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>
);
export const IconBack = (p: Props) => (
  <Svg {...p}><path d="m15 5-7 7 7 7" /></Svg>
);
export const IconBell = (p: Props) => (
  <Svg {...p}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" /><path d="M10.3 19a2 2 0 0 0 3.4 0" /></Svg>
);
export const IconSearch = (p: Props) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>
);
export const IconCard = (p: Props) => (
  <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 14.5h4" /></Svg>
);
export const IconTicket = (p: Props) => (
  <Svg {...p}><path d="M4 8.5V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5Z" /><path d="M13 6v12" strokeDasharray="2 2.5" /></Svg>
);
export const IconTrophy = (p: Props) => (
  <Svg {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" /><path d="M12 14v3.5M8.5 20.5h7" /></Svg>
);
export const IconCheck = (p: Props) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconClose = (p: Props) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const IconMail = (p: Props) => (
  <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 8 8 5.5L20 8" /></Svg>
);
export const IconPhone = (p: Props) => (
  <Svg {...p}><path d="M7 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5 5.7 2 2 0 0 1 7 3.5Z" /></Svg>
);
export const IconWarning = (p: Props) => (
  <Svg {...p}><path d="M12 4.5 21 19H3l9-14.5Z" /><path d="M12 10v4M12 16.5v.5" /></Svg>
);
export const IconTrash = (p: Props) => (
  <Svg {...p}><path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" /><path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-13.5" /></Svg>
);
export const IconDownload = (p: Props) => (
  <Svg {...p}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></Svg>
);
