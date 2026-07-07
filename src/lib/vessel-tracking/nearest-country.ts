export type CountryAnchor = {
  nameAr: string;
  nameEn: string;
  lat: number;
  lon: number;
  seas?: string[];
};

const COUNTRY_ANCHORS: CountryAnchor[] = [
  { nameAr: "مصر", nameEn: "Egypt", lat: 27.9, lon: 34.3, seas: ["red sea", "mediterranean sea", "mediterranean"] },
  { nameAr: "السعودية", nameEn: "Saudi Arabia", lat: 21.5, lon: 39.2, seas: ["red sea", "arabian sea", "persian gulf", "gulf"] },
  { nameAr: "السودان", nameEn: "Sudan", lat: 19.6, lon: 37.2, seas: ["red sea"] },
  { nameAr: "إريتريا", nameEn: "Eritrea", lat: 15.6, lon: 39.2, seas: ["red sea"] },
  { nameAr: "اليمن", nameEn: "Yemen", lat: 14.8, lon: 42.9, seas: ["red sea", "arabian sea", "gulf of aden"] },
  { nameAr: "الأردن", nameEn: "Jordan", lat: 29.5, lon: 35.0, seas: ["red sea"] },
  { nameAr: "إسرائيل", nameEn: "Israel", lat: 29.5, lon: 34.8, seas: ["red sea", "mediterranean sea", "mediterranean"] },
  { nameAr: "الإمارات", nameEn: "UAE", lat: 24.5, lon: 54.4, seas: ["persian gulf", "gulf", "arabian sea"] },
  { nameAr: "عُمان", nameEn: "Oman", lat: 23.6, lon: 58.5, seas: ["arabian sea", "gulf of oman", "persian gulf"] },
  { nameAr: "الكويت", nameEn: "Kuwait", lat: 29.3, lon: 48.0, seas: ["persian gulf", "gulf"] },
  { nameAr: "قطر", nameEn: "Qatar", lat: 25.3, lon: 51.5, seas: ["persian gulf", "gulf"] },
  { nameAr: "البحرين", nameEn: "Bahrain", lat: 26.2, lon: 50.6, seas: ["persian gulf", "gulf"] },
  { nameAr: "العراق", nameEn: "Iraq", lat: 30.0, lon: 47.9, seas: ["persian gulf", "gulf"] },
  { nameAr: "إيران", nameEn: "Iran", lat: 27.2, lon: 56.3, seas: ["persian gulf", "gulf", "arabian sea"] },
  { nameAr: "الصين", nameEn: "China", lat: 30.0, lon: 122.0, seas: ["east china sea", "south china sea", "yellow sea", "pacific ocean"] },
  { nameAr: "الفلبين", nameEn: "Philippines", lat: 14.6, lon: 121.0, seas: ["philippine sea", "south china sea", "pacific ocean", "west philippine sea"] },
  { nameAr: "سنغافورة", nameEn: "Singapore", lat: 1.3, lon: 103.8, seas: ["south china sea", "strait of malacca", "java sea"] },
  { nameAr: "ماليزيا", nameEn: "Malaysia", lat: 4.2, lon: 100.3, seas: ["strait of malacca", "south china sea"] },
  { nameAr: "إندونيسيا", nameEn: "Indonesia", lat: -6.1, lon: 106.8, seas: ["java sea", "south china sea", "indian ocean"] },
  { nameAr: "الهند", nameEn: "India", lat: 19.0, lon: 72.8, seas: ["arabian sea", "indian ocean", "bay of bengal"] },
  { nameAr: "باكستان", nameEn: "Pakistan", lat: 24.8, lon: 66.9, seas: ["arabian sea", "indian ocean"] },
  { nameAr: "تركيا", nameEn: "Turkey", lat: 41.0, lon: 29.0, seas: ["mediterranean sea", "mediterranean", "black sea", "aegean sea"] },
  { nameAr: "اليونان", nameEn: "Greece", lat: 37.9, lon: 23.7, seas: ["mediterranean sea", "mediterranean", "aegean sea"] },
  { nameAr: "إيطاليا", nameEn: "Italy", lat: 41.9, lon: 12.5, seas: ["mediterranean sea", "mediterranean", "tyrrhenian sea"] },
  { nameAr: "ليبيا", nameEn: "Libya", lat: 32.9, lon: 13.2, seas: ["mediterranean sea", "mediterranean"] },
  { nameAr: "تونس", nameEn: "Tunisia", lat: 36.8, lon: 10.2, seas: ["mediterranean sea", "mediterranean"] },
  { nameAr: "الجزائر", nameEn: "Algeria", lat: 36.8, lon: 3.1, seas: ["mediterranean sea", "mediterranean"] },
  { nameAr: "المغرب", nameEn: "Morocco", lat: 33.6, lon: -7.6, seas: ["mediterranean sea", "mediterranean", "atlantic ocean"] },
  { nameAr: "جنوب أفريقيا", nameEn: "South Africa", lat: -33.9, lon: 18.4, seas: ["atlantic ocean", "indian ocean"] },
  { nameAr: "نيجيريا", nameEn: "Nigeria", lat: 6.5, lon: 3.4, seas: ["atlantic ocean", "gulf of guinea"] },
  { nameAr: "البرازيل", nameEn: "Brazil", lat: -22.9, lon: -43.2, seas: ["atlantic ocean", "south atlantic"] },
  { nameAr: "الولايات المتحدة", nameEn: "USA", lat: 40.7, lon: -74.0, seas: ["atlantic ocean", "pacific ocean", "gulf of mexico"] },
  { nameAr: "المملكة المتحدة", nameEn: "United Kingdom", lat: 51.5, lon: -0.1, seas: ["atlantic ocean", "north sea", "english channel"] },
  { nameAr: "فرنسا", nameEn: "France", lat: 43.3, lon: 5.4, seas: ["mediterranean sea", "mediterranean", "atlantic ocean", "english channel"] },
  { nameAr: "إسبانيا", nameEn: "Spain", lat: 36.1, lon: -5.4, seas: ["mediterranean sea", "mediterranean", "atlantic ocean"] },
  { nameAr: "أستراليا", nameEn: "Australia", lat: -33.9, lon: 151.2, seas: ["pacific ocean", "indian ocean", "tasman sea"] },
  { nameAr: "اليابان", nameEn: "Japan", lat: 35.7, lon: 139.7, seas: ["pacific ocean", "east china sea", "sea of japan"] },
  { nameAr: "كوريا الجنوبية", nameEn: "South Korea", lat: 35.1, lon: 129.0, seas: ["yellow sea", "east china sea", "sea of japan"] },
];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeSea(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function seaMatches(area: string, seaToken: string) {
  const normalizedArea = normalizeSea(area);
  const normalizedSea = normalizeSea(seaToken);
  return normalizedArea.includes(normalizedSea) || normalizedSea.includes(normalizedArea);
}

export function nearestCountry(lat: number, lon: number, seaArea?: string | null): CountryAnchor {
  const pool = seaArea
    ? COUNTRY_ANCHORS.filter((country) => country.seas?.some((sea) => seaMatches(seaArea, sea)))
    : COUNTRY_ANCHORS;

  const candidates = pool.length ? pool : COUNTRY_ANCHORS;

  return candidates.reduce((best, current) => {
    const currentDistance = haversineKm(lat, lon, current.lat, current.lon);
    const bestDistance = haversineKm(lat, lon, best.lat, best.lon);
    return currentDistance < bestDistance ? current : best;
  });
}

export const SEA_LABELS_AR: Record<string, string> = {
  "red sea": "البحر الأحمر",
  "arabian sea": "بحر العرب",
  "persian gulf": "الخليج العربي",
  gulf: "الخليج العربي",
  "gulf of aden": "خليج عدن",
  "mediterranean sea": "البحر المتوسط",
  mediterranean: "البحر المتوسط",
  "south china sea": "بحر الصين الجنوبي",
  "east china sea": "بحر الصين الشرقي",
  "yellow sea": "البحر الأصفر",
  "philippine sea": "البحر الفلبيني",
  "west philippine sea": "البحر الفلبيني الغربي",
  "indian ocean": "المحيط الهندي",
  "pacific ocean": "المحيط الهادئ",
  "atlantic ocean": "المحيط الأطلسي",
  "bay of bengal": "خليج البنغال",
  "north sea": "بحر الشمال",
  "black sea": "البحر الأسود",
  "aegean sea": "بحر إيجة",
  "sea of japan": "بحر اليابان",
  "java sea": "بحر جاوة",
  "strait of malacca": "مضيق ملقا",
  "gulf of mexico": "خليج المكسيك",
  "gulf of guinea": "خليج غينيا",
  "english channel": "القنال الإنجليزي",
  "tasman sea": "بحر تسمان",
  "tyrrhenian sea": "البحر التيريني",
  "south atlantic": "جنوب الأطلسي",
};

export function seaAreaToArabic(area: string) {
  const normalized = normalizeSea(area);
  if (SEA_LABELS_AR[normalized]) return SEA_LABELS_AR[normalized];

  for (const [key, label] of Object.entries(SEA_LABELS_AR)) {
    if (normalized.includes(key)) return label;
  }

  return area.trim();
}

export function formatVesselLocationText(options: {
  seaArea?: string | null;
  nearestCountryAr?: string | null;
}) {
  const seaAr = options.seaArea ? seaAreaToArabic(options.seaArea) : null;
  const countryAr = options.nearestCountryAr?.trim() || null;

  if (countryAr && seaAr) return `${seaAr} (${countryAr})`;
  if (countryAr) return countryAr;
  if (seaAr) return seaAr;
  return null;
}
