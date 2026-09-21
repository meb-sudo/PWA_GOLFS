/**
 * Meteo du jour de jeu via Open-Meteo (https://open-meteo.com).
 *
 * API publique gratuite, sans cle, prevision jusqu a 16 jours -- ce qui couvre
 * la fenetre de reservation des clubs (~14 jours). Appelee UNIQUEMENT cote
 * serveur : le front ne parle qu au BFF. La meteo ne vient PAS des API golf ;
 * on la deduit des coordonnees GPS du club (ClubInfo.geo).
 */

export interface DayWeather {
  /** Date de la prevision, "AAAA-MM-JJ". */
  date: string;
  /** Code meteo WMO d origine. */
  code: number;
  /** Libelle francais des conditions. */
  condition: string;
  /** Emoji correspondant. */
  icon: string;
  tempMax: number;
  tempMin: number;
  /** Probabilite de pluie max (%). */
  rainProbability: number;
  /** Vent max (km/h). */
  windMax: number;
}

/** Codes WMO -> libelle FR + emoji (regroupes par famille). */
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Ensoleillé', icon: '☀️' },
  1: { label: 'Plutôt ensoleillé', icon: '🌤️' },
  2: { label: 'Partiellement nuageux', icon: '⛅' },
  3: { label: 'Nuageux', icon: '☁️' },
  45: { label: 'Brouillard', icon: '🌫️' },
  48: { label: 'Brouillard givrant', icon: '🌫️' },
  51: { label: 'Bruine légère', icon: '🌦️' },
  53: { label: 'Bruine', icon: '🌦️' },
  55: { label: 'Bruine dense', icon: '🌦️' },
  56: { label: 'Bruine verglaçante', icon: '🌧️' },
  57: { label: 'Bruine verglaçante', icon: '🌧️' },
  61: { label: 'Pluie faible', icon: '🌦️' },
  63: { label: 'Pluie', icon: '🌧️' },
  65: { label: 'Forte pluie', icon: '🌧️' },
  66: { label: 'Pluie verglaçante', icon: '🌧️' },
  67: { label: 'Pluie verglaçante', icon: '🌧️' },
  71: { label: 'Neige faible', icon: '🌨️' },
  73: { label: 'Neige', icon: '🌨️' },
  75: { label: 'Forte neige', icon: '❄️' },
  77: { label: 'Grains de neige', icon: '🌨️' },
  80: { label: 'Averses', icon: '🌦️' },
  81: { label: 'Averses', icon: '🌧️' },
  82: { label: 'Fortes averses', icon: '⛈️' },
  85: { label: 'Averses de neige', icon: '🌨️' },
  86: { label: 'Averses de neige', icon: '❄️' },
  95: { label: 'Orage', icon: '⛈️' },
  96: { label: 'Orage, grêle', icon: '⛈️' },
  99: { label: 'Orage, grêle', icon: '⛈️' },
};

function describe(code: number): { label: string; icon: string } {
  return WMO[code] ?? { label: 'Variable', icon: '🌡️' };
}

interface OpenMeteoDaily {
  time?: string[];
  weathercode?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: (number | null)[];
  windspeed_10m_max?: number[];
}

/**
 * Prevision d un seul jour pour un point GPS. Renvoie null si la date est hors
 * de la portee de prevision ou en cas de probleme reseau (jamais d exception).
 */
export async function dailyForecast(
  lat: number, lng: number, date: string,
): Promise<DayWeather | null> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lng}`
    + '&daily=weathercode,temperature_2m_max,temperature_2m_min,'
    + 'precipitation_probability_max,windspeed_10m_max'
    + `&timezone=auto&start_date=${date}&end_date=${date}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: OpenMeteoDaily };
    const d = json.daily;
    if (!d?.time || d.time.length === 0) return null;

    const code = d.weathercode?.[0] ?? 0;
    const desc = describe(code);
    return {
      date: d.time[0]!,
      code,
      condition: desc.label,
      icon: desc.icon,
      tempMax: Math.round(d.temperature_2m_max?.[0] ?? 0),
      tempMin: Math.round(d.temperature_2m_min?.[0] ?? 0),
      rainProbability: Math.round(d.precipitation_probability_max?.[0] ?? 0),
      windMax: Math.round(d.windspeed_10m_max?.[0] ?? 0),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
