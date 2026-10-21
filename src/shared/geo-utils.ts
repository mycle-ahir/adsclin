import type { FingerprintConfig } from './types';

export interface CountryGeoData {
  code: string;
  name: string;
  primaryTimezone: string;
  timezones: string[];
  languages: string[];
  coordinates: { lat: number; lon: number };
}

export const COUNTRY_GEO_REGISTRY: Record<string, CountryGeoData> = {
  US: {
    code: 'US',
    name: 'United States',
    primaryTimezone: 'America/New_York',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'],
    languages: ['en-US', 'en'],
    coordinates: { lat: 37.0902, lon: -95.7129 },
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    primaryTimezone: 'Europe/London',
    timezones: ['Europe/London'],
    languages: ['en-GB', 'en'],
    coordinates: { lat: 55.3781, lon: -3.436 },
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    primaryTimezone: 'America/Toronto',
    timezones: ['America/Toronto', 'America/Vancouver', 'America/Montreal', 'America/Edmonton', 'America/Halifax'],
    languages: ['en-CA', 'en', 'fr-CA', 'fr'],
    coordinates: { lat: 56.1304, lon: -106.3468 },
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    primaryTimezone: 'Europe/Berlin',
    timezones: ['Europe/Berlin'],
    languages: ['de-DE', 'de', 'en-US', 'en'],
    coordinates: { lat: 51.1657, lon: 10.4515 },
  },
  FR: {
    code: 'FR',
    name: 'France',
    primaryTimezone: 'Europe/Paris',
    timezones: ['Europe/Paris'],
    languages: ['fr-FR', 'fr', 'en-US', 'en'],
    coordinates: { lat: 46.2276, lon: 2.2137 },
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    primaryTimezone: 'Australia/Sydney',
    timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide'],
    languages: ['en-AU', 'en'],
    coordinates: { lat: -25.2744, lon: 133.7751 },
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    primaryTimezone: 'Asia/Tokyo',
    timezones: ['Asia/Tokyo'],
    languages: ['ja-JP', 'ja', 'en-US', 'en'],
    coordinates: { lat: 36.2048, lon: 138.2529 },
  },
  IN: {
    code: 'IN',
    name: 'India',
    primaryTimezone: 'Asia/Kolkata',
    timezones: ['Asia/Kolkata'],
    languages: ['en-IN', 'en', 'hi-IN', 'hi'],
    coordinates: { lat: 20.5937, lon: 78.9629 },
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    primaryTimezone: 'America/Sao_Paulo',
    timezones: ['America/Sao_Paulo', 'America/Fortaleza', 'America/Manaus'],
    languages: ['pt-BR', 'pt', 'en-US', 'en'],
    coordinates: { lat: -14.235, lon: -51.9253 },
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    primaryTimezone: 'Europe/Amsterdam',
    timezones: ['Europe/Amsterdam'],
    languages: ['nl-NL', 'nl', 'en-US', 'en'],
    coordinates: { lat: 52.1326, lon: 5.2913 },
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    primaryTimezone: 'Europe/Madrid',
    timezones: ['Europe/Madrid'],
    languages: ['es-ES', 'es', 'en-US', 'en'],
    coordinates: { lat: 40.4637, lon: -3.7492 },
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    primaryTimezone: 'Europe/Rome',
    timezones: ['Europe/Rome'],
    languages: ['it-IT', 'it', 'en-US', 'en'],
    coordinates: { lat: 41.8719, lon: 12.5674 },
  },
  RU: {
    code: 'RU',
    name: 'Russian Federation',
    primaryTimezone: 'Europe/Moscow',
    timezones: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'],
    languages: ['ru-RU', 'ru', 'en-US', 'en'],
    coordinates: { lat: 61.524, lon: 105.3188 },
  },
  UA: {
    code: 'UA',
    name: 'Ukraine',
    primaryTimezone: 'Europe/Kyiv',
    timezones: ['Europe/Kyiv'],
    languages: ['uk-UA', 'uk', 'en-US', 'en'],
    coordinates: { lat: 48.3794, lon: 31.1656 },
  },
  PL: {
    code: 'PL',
    name: 'Poland',
    primaryTimezone: 'Europe/Warsaw',
    timezones: ['Europe/Warsaw'],
    languages: ['pl-PL', 'pl', 'en-US', 'en'],
    coordinates: { lat: 51.9194, lon: 19.1451 },
  },
  TR: {
    code: 'TR',
    name: 'Turkey',
    primaryTimezone: 'Europe/Istanbul',
    timezones: ['Europe/Istanbul'],
    languages: ['tr-TR', 'tr', 'en-US', 'en'],
    coordinates: { lat: 38.9637, lon: 35.2433 },
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    primaryTimezone: 'Asia/Singapore',
    timezones: ['Asia/Singapore'],
    languages: ['en-SG', 'en', 'zh-SG', 'zh'],
    coordinates: { lat: 1.3521, lon: 103.8198 },
  },
  KR: {
    code: 'KR',
    name: 'South Korea',
    primaryTimezone: 'Asia/Seoul',
    timezones: ['Asia/Seoul'],
    languages: ['ko-KR', 'ko', 'en-US', 'en'],
    coordinates: { lat: 35.9078, lon: 127.7669 },
  },
  CN: {
    code: 'CN',
    name: 'China',
    primaryTimezone: 'Asia/Shanghai',
    timezones: ['Asia/Shanghai'],
    languages: ['zh-CN', 'zh', 'en-US', 'en'],
    coordinates: { lat: 35.8617, lon: 104.1954 },
  },
  HK: {
    code: 'HK',
    name: 'Hong Kong',
    primaryTimezone: 'Asia/Hong_Kong',
    timezones: ['Asia/Hong_Kong'],
    languages: ['zh-HK', 'zh', 'en-HK', 'en'],
    coordinates: { lat: 22.3193, lon: 114.1694 },
  },
  TW: {
    code: 'TW',
    name: 'Taiwan',
    primaryTimezone: 'Asia/Taipei',
    timezones: ['Asia/Taipei'],
    languages: ['zh-TW', 'zh', 'en-US', 'en'],
    coordinates: { lat: 23.6978, lon: 120.9605 },
  },
  SE: {
    code: 'SE',
    name: 'Sweden',
    primaryTimezone: 'Europe/Stockholm',
    timezones: ['Europe/Stockholm'],
    languages: ['sv-SE', 'sv', 'en-US', 'en'],
    coordinates: { lat: 60.1282, lon: 18.6435 },
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    primaryTimezone: 'Europe/Zurich',
    timezones: ['Europe/Zurich'],
    languages: ['de-CH', 'fr-CH', 'it-CH', 'en'],
    coordinates: { lat: 46.8182, lon: 8.2275 },
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    primaryTimezone: 'Europe/Vienna',
    timezones: ['Europe/Vienna'],
    languages: ['de-AT', 'de', 'en-US', 'en'],
    coordinates: { lat: 47.5162, lon: 14.5501 },
  },
  BE: {
    code: 'BE',
    name: 'Belgium',
    primaryTimezone: 'Europe/Brussels',
    timezones: ['Europe/Brussels'],
    languages: ['nl-BE', 'fr-BE', 'nl', 'fr', 'en'],
    coordinates: { lat: 50.5039, lon: 4.4699 },
  },
  DK: {
    code: 'DK',
    name: 'Denmark',
    primaryTimezone: 'Europe/Copenhagen',
    timezones: ['Europe/Copenhagen'],
    languages: ['da-DK', 'da', 'en-US', 'en'],
    coordinates: { lat: 56.2639, lon: 9.5018 },
  },
  FI: {
    code: 'FI',
    name: 'Finland',
    primaryTimezone: 'Europe/Helsinki',
    timezones: ['Europe/Helsinki'],
    languages: ['fi-FI', 'fi', 'sv-FI', 'en'],
    coordinates: { lat: 61.9241, lon: 25.7482 },
  },
  NO: {
    code: 'NO',
    name: 'Norway',
    primaryTimezone: 'Europe/Oslo',
    timezones: ['Europe/Oslo'],
    languages: ['nb-NO', 'no', 'en-US', 'en'],
    coordinates: { lat: 60.472, lon: 8.4689 },
  },
  IE: {
    code: 'IE',
    name: 'Ireland',
    primaryTimezone: 'Europe/Dublin',
    timezones: ['Europe/Dublin'],
    languages: ['en-IE', 'en', 'ga-IE'],
    coordinates: { lat: 53.4129, lon: -8.2439 },
  },
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    primaryTimezone: 'Pacific/Auckland',
    timezones: ['Pacific/Auckland'],
    languages: ['en-NZ', 'en'],
    coordinates: { lat: -40.9006, lon: 174.886 },
  },
  MX: {
    code: 'MX',
    name: 'Mexico',
    primaryTimezone: 'America/Mexico_City',
    timezones: ['America/Mexico_City', 'America/Cancun', 'America/Tijuana'],
    languages: ['es-MX', 'es', 'en-US', 'en'],
    coordinates: { lat: 23.6345, lon: -102.5528 },
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    primaryTimezone: 'America/Argentina/Buenos_Aires',
    timezones: ['America/Argentina/Buenos_Aires'],
    languages: ['es-AR', 'es', 'en-US', 'en'],
    coordinates: { lat: -38.4161, lon: -63.6167 },
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    primaryTimezone: 'America/Santiago',
    timezones: ['America/Santiago'],
    languages: ['es-CL', 'es', 'en-US', 'en'],
    coordinates: { lat: -35.6751, lon: -71.543 },
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    primaryTimezone: 'America/Bogota',
    timezones: ['America/Bogota'],
    languages: ['es-CO', 'es', 'en-US', 'en'],
    coordinates: { lat: 4.5709, lon: -74.2973 },
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    primaryTimezone: 'Africa/Johannesburg',
    timezones: ['Africa/Johannesburg'],
    languages: ['en-ZA', 'af-ZA', 'en'],
    coordinates: { lat: -30.5595, lon: 22.9375 },
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    primaryTimezone: 'Asia/Dubai',
    timezones: ['Asia/Dubai'],
    languages: ['ar-AE', 'ar', 'en-AE', 'en'],
    coordinates: { lat: 23.4241, lon: 53.8478 },
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    primaryTimezone: 'Asia/Riyadh',
    timezones: ['Asia/Riyadh'],
    languages: ['ar-SA', 'ar', 'en-US', 'en'],
    coordinates: { lat: 23.8859, lon: 45.0792 },
  },
  IL: {
    code: 'IL',
    name: 'Israel',
    primaryTimezone: 'Asia/Jerusalem',
    timezones: ['Asia/Jerusalem'],
    languages: ['he-IL', 'he', 'en-US', 'en'],
    coordinates: { lat: 31.0461, lon: 34.8516 },
  },
  RO: {
    code: 'RO',
    name: 'Romania',
    primaryTimezone: 'Europe/Bucharest',
    timezones: ['Europe/Bucharest'],
    languages: ['ro-RO', 'ro', 'en-US', 'en'],
    coordinates: { lat: 45.9432, lon: 24.9668 },
  },
  CZ: {
    code: 'CZ',
    name: 'Czech Republic',
    primaryTimezone: 'Europe/Prague',
    timezones: ['Europe/Prague'],
    languages: ['cs-CZ', 'cs', 'en-US', 'en'],
    coordinates: { lat: 49.8175, lon: 15.473 },
  },
  HU: {
    code: 'HU',
    name: 'Hungary',
    primaryTimezone: 'Europe/Budapest',
    timezones: ['Europe/Budapest'],
    languages: ['hu-HU', 'hu', 'en-US', 'en'],
    coordinates: { lat: 47.1625, lon: 19.5033 },
  },
  GR: {
    code: 'GR',
    name: 'Greece',
    primaryTimezone: 'Europe/Athens',
    timezones: ['Europe/Athens'],
    languages: ['el-GR', 'el', 'en-US', 'en'],
    coordinates: { lat: 39.0742, lon: 21.8243 },
  },
  ID: {
    code: 'ID',
    name: 'Indonesia',
    primaryTimezone: 'Asia/Jakarta',
    timezones: ['Asia/Jakarta'],
    languages: ['id-ID', 'id', 'en-US', 'en'],
    coordinates: { lat: -0.7893, lon: 113.9213 },
  },
  MY: {
    code: 'MY',
    name: 'Malaysia',
    primaryTimezone: 'Asia/Kuala_Lumpur',
    timezones: ['Asia/Kuala_Lumpur'],
    languages: ['ms-MY', 'ms', 'en-MY', 'en'],
    coordinates: { lat: 4.2105, lon: 101.9758 },
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    primaryTimezone: 'Asia/Bangkok',
    timezones: ['Asia/Bangkok'],
    languages: ['th-TH', 'th', 'en-US', 'en'],
    coordinates: { lat: 15.87, lon: 100.9925 },
  },
  VN: {
    code: 'VN',
    name: 'Vietnam',
    primaryTimezone: 'Asia/Ho_Chi_Minh',
    timezones: ['Asia/Ho_Chi_Minh'],
    languages: ['vi-VN', 'vi', 'en-US', 'en'],
    coordinates: { lat: 14.0583, lon: 108.2772 },
  },
  PH: {
    code: 'PH',
    name: 'Philippines',
    primaryTimezone: 'Asia/Manila',
    timezones: ['Asia/Manila'],
    languages: ['en-PH', 'fil-PH', 'en', 'tl'],
    coordinates: { lat: 12.8797, lon: 121.774 },
  },
  EG: {
    code: 'EG',
    name: 'Egypt',
    primaryTimezone: 'Africa/Cairo',
    timezones: ['Africa/Cairo'],
    languages: ['ar-EG', 'ar', 'en-US', 'en'],
    coordinates: { lat: 26.8206, lon: 30.8025 },
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    primaryTimezone: 'Africa/Lagos',
    timezones: ['Africa/Lagos'],
    languages: ['en-NG', 'en'],
    coordinates: { lat: 9.082, lon: 8.6753 },
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    primaryTimezone: 'Europe/Lisbon',
    timezones: ['Europe/Lisbon'],
    languages: ['pt-PT', 'pt', 'en-US', 'en'],
    coordinates: { lat: 39.3999, lon: -8.2245 },
  },
};

/**
 * Normalizes input string (code or name) to upper-cased 2-letter country code.
 */
export function normalizeCountryCode(countryStr: string | null | undefined): string | null {
  if (!countryStr) return null;
  const clean = countryStr.trim();
  if (!clean) return null;

  // Direct 2-letter code check
  const upper = clean.toUpperCase();
  if (COUNTRY_GEO_REGISTRY[upper]) {
    return upper;
  }

  // Check matching by name
  const lower = clean.toLowerCase();
  for (const [code, data] of Object.entries(COUNTRY_GEO_REGISTRY)) {
    if (data.name.toLowerCase() === lower || data.name.toLowerCase().includes(lower)) {
      return code;
    }
  }

  // Fallback: If 2 letters, return as is
  if (clean.length === 2) {
    return upper;
  }

  return null;
}

/**
 * Gets primary timezone for a country code or name.
 */
export function getTimezoneForCountry(countryStr: string | null | undefined): string {
  const code = normalizeCountryCode(countryStr);
  if (code && COUNTRY_GEO_REGISTRY[code]) {
    return COUNTRY_GEO_REGISTRY[code].primaryTimezone;
  }
  return 'America/New_York';
}

/**
 * Gets recommended language array for a country code or name.
 */
export function getLanguagesForCountry(countryStr: string | null | undefined): string[] {
  const code = normalizeCountryCode(countryStr);
  if (code && COUNTRY_GEO_REGISTRY[code]) {
    return [...COUNTRY_GEO_REGISTRY[code].languages];
  }
  return ['en-US', 'en'];
}

/**
 * Gets approximate default coordinates for a country.
 */
export function getCoordinatesForCountry(countryStr: string | null | undefined): { lat: number; lon: number } | null {
  const code = normalizeCountryCode(countryStr);
  if (code && COUNTRY_GEO_REGISTRY[code]) {
    return { ...COUNTRY_GEO_REGISTRY[code].coordinates };
  }
  return null;
}

export interface GeoAdjustmentOptions {
  country?: string | null | undefined;
  timezone?: string | null | undefined;
  loc?: string | null | undefined;
  ip?: string | null | undefined;
}

/**
 * Automatically adjusts a FingerprintConfig's timezone, languages, and geolocation
 * to match proxy location.
 */
export function adjustFingerprintToGeo(
  fingerprint: FingerprintConfig,
  geo: GeoAdjustmentOptions
): FingerprintConfig {
  const updated: FingerprintConfig = { ...fingerprint };

  // 1. Timezone adjustment
  if (geo.timezone && geo.timezone.trim()) {
    updated.timezone = geo.timezone.trim();
  } else if (geo.country) {
    updated.timezone = getTimezoneForCountry(geo.country);
  }

  // 2. Languages adjustment
  if (geo.country) {
    updated.languages = getLanguagesForCountry(geo.country);
  }

  // 3. Geolocation adjustment
  if (geo.loc && geo.loc.includes(',')) {
    const parts = geo.loc.split(',');
    const lat = parseFloat(parts[0]?.trim() ?? '0');
    const lon = parseFloat(parts[1]?.trim() ?? '0');
    if (!isNaN(lat) && !isNaN(lon)) {
      updated.geolocation = { lat, lon, accuracy: 50 };
    }
  } else if (geo.country) {
    const coords = getCoordinatesForCountry(geo.country);
    if (coords) {
      updated.geolocation = { lat: coords.lat, lon: coords.lon, accuracy: 500 };
    }
  }

  return updated;
}
