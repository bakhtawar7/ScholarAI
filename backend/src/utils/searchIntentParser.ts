/**
 * Natural-language search intent parser for the chat assistant.
 *
 * The deterministic orchestrator previously passed the user's entire message as the
 * `q` keyword: "Find scholarships in Berlin" was searched as a literal substring
 * against title/provider/university, which matches nothing. Worse, when a country was
 * also detected, `q` and `hostCountry` were ANDed together, so even
 * "Find scholarships in Germany" returned zero results.
 *
 * This module extracts the meaningful parts — country, city, degree level, field and
 * residual keywords — so the search receives structured filters instead of a sentence.
 */

/** Aliases → canonical `hostCountry` values used in the catalogue. */
const COUNTRY_ALIASES: Record<string, string> = {
  germany: 'Germany',
  german: 'Germany',
  deutschland: 'Germany',
  'united kingdom': 'United Kingdom',
  uk: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'united states': 'United States',
  usa: 'United States',
  us: 'United States',
  america: 'United States',
  american: 'United States',
  sweden: 'Sweden',
  swedish: 'Sweden',
  france: 'France',
  french: 'France',
  canada: 'Canada',
  canadian: 'Canada',
  australia: 'Australia',
  australian: 'Australia',
  japan: 'Japan',
  japanese: 'Japan',
  switzerland: 'Switzerland',
  swiss: 'Switzerland',
  singapore: 'Singapore',
  'south korea': 'South Korea',
  korea: 'South Korea',
  korean: 'South Korea',
  netherlands: 'Netherlands',
  holland: 'Netherlands',
  dutch: 'Netherlands',
  italy: 'Italy',
  spain: 'Spain',
  norway: 'Norway',
  denmark: 'Denmark',
  finland: 'Finland',
  belgium: 'Belgium',
  austria: 'Austria',
  ireland: 'Ireland',
  'new zealand': 'New Zealand',
  china: 'China',
  'hong kong': 'Hong Kong',
  taiwan: 'Taiwan',
  turkey: 'Turkey',
  poland: 'Poland',
  portugal: 'Portugal',
  'czech republic': 'Czech Republic',
  hungary: 'Hungary',
  qatar: 'Qatar',
  'saudi arabia': 'Saudi Arabia',
  uae: 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
};

/**
 * Major study cities → their country.
 *
 * Scholarships are awarded at national or institutional level, so the catalogue has no
 * city column. When a user names a city we search it as free text (it often appears in
 * the university field, e.g. "University of Passau") and fall back to the country.
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  berlin: 'Germany',
  munich: 'Germany',
  münchen: 'Germany',
  hamburg: 'Germany',
  frankfurt: 'Germany',
  cologne: 'Germany',
  heidelberg: 'Germany',
  stuttgart: 'Germany',
  dresden: 'Germany',
  aachen: 'Germany',
  passau: 'Germany',
  bonn: 'Germany',
  london: 'United Kingdom',
  oxford: 'United Kingdom',
  cambridge: 'United Kingdom',
  manchester: 'United Kingdom',
  edinburgh: 'United Kingdom',
  glasgow: 'United Kingdom',
  birmingham: 'United Kingdom',
  bristol: 'United Kingdom',
  leeds: 'United Kingdom',
  boston: 'United States',
  'new york': 'United States',
  chicago: 'United States',
  'san francisco': 'United States',
  'los angeles': 'United States',
  seattle: 'United States',
  stanford: 'United States',
  berkeley: 'United States',
  paris: 'France',
  lyon: 'France',
  toulouse: 'France',
  grenoble: 'France',
  stockholm: 'Sweden',
  uppsala: 'Sweden',
  lund: 'Sweden',
  gothenburg: 'Sweden',
  zurich: 'Switzerland',
  zürich: 'Switzerland',
  geneva: 'Switzerland',
  lausanne: 'Switzerland',
  basel: 'Switzerland',
  tokyo: 'Japan',
  osaka: 'Japan',
  kyoto: 'Japan',
  toronto: 'Canada',
  vancouver: 'Canada',
  montreal: 'Canada',
  ottawa: 'Canada',
  melbourne: 'Australia',
  sydney: 'Australia',
  brisbane: 'Australia',
  canberra: 'Australia',
  perth: 'Australia',
  amsterdam: 'Netherlands',
  delft: 'Netherlands',
  eindhoven: 'Netherlands',
  utrecht: 'Netherlands',
  seoul: 'South Korea',
  daejeon: 'South Korea',
  busan: 'South Korea',
  vienna: 'Austria',
  copenhagen: 'Denmark',
  oslo: 'Norway',
  helsinki: 'Finland',
  milan: 'Italy',
  rome: 'Italy',
  madrid: 'Spain',
  barcelona: 'Spain',
  dublin: 'Ireland',
  beijing: 'China',
  shanghai: 'China',
};

const DEGREE_PATTERNS: Array<{ re: RegExp; value: string }> = [
  { re: /\b(bachelor'?s?|undergraduate|bs|ba|bsc)\b/i, value: 'BACHELORS' },
  { re: /\b(master'?s?|masters|msc|ms|mba|graduate|postgraduate|grad school)\b/i, value: 'MASTERS' },
  { re: /\b(phd|ph\.?d|doctoral|doctorate)\b/i, value: 'PHD' },
  { re: /\b(postdoc|post-doc|postdoctoral)\b/i, value: 'POSTDOC' },
];

const FUNDING_PATTERNS: Array<{ re: RegExp; value: string }> = [
  { re: /\b(fully funded|full funding|full scholarship|fully-funded|100%)\b/i, value: 'FULL_FUNDING' },
  { re: /\b(partial funding|partially funded|partial scholarship)\b/i, value: 'PARTIAL_FUNDING' },
  { re: /\b(tuition only|tuition waiver only)\b/i, value: 'TUITION_ONLY' },
];

/** Filler that carries no search signal. */
const STOPWORDS = new Set([
  'a','about','all','and','any','anywhere','are','around','as','at','available','best','can',
  'city','cities','copilot','could','country','countries','do','does','find','for','from','get',
  'give','go','good','have','help','how','i','in','into','is','it','know','list','look','looking',
  'me','my','need','of','offer','offering','on','open','opportunities','opportunity','or','please',
  'programme','programmes','program','programs','recommend','scholarship','scholarships','search',
  'see','show','some','study','studying','suggest','tell','that','the','there','these','they','this',
  'to','university','universities','us','want','was','what','whats','where','which','with','within',
  'would','you','your',
]);

export interface ParsedSearchIntent {
  /** Canonical hostCountry, when the user named a country or a recognised city. */
  hostCountry?: string;
  /** City the user named, searched as free text. */
  city?: string;
  /** True when hostCountry was inferred from a city rather than stated directly. */
  countryInferredFromCity: boolean;
  degreeLevel?: string;
  fundingType?: string;
  /** Residual meaningful terms, filler removed. */
  keywords: string;
  /** Every location the user mentioned, for messaging. */
  locationLabel?: string;
}

/**
 * Longest-first matching so "united kingdom" wins over "uk", and "new york" is not
 * split into "new" + "york".
 */
function findLongestMatch(haystack: string, table: Record<string, string>): { key: string; value: string } | null {
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    // Word-boundary match so "us" does not fire inside "australia".
    const re = new RegExp(`(^|[^a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    if (re.test(haystack)) return { key, value: table[key] };
  }
  return null;
}

export function parseSearchIntent(rawText: string): ParsedSearchIntent {
  const text = String(rawText || '').trim();
  const lower = text.toLowerCase();

  const result: ParsedSearchIntent = { countryInferredFromCity: false, keywords: '' };

  // 1. Country stated outright.
  const countryMatch = findLongestMatch(lower, COUNTRY_ALIASES);
  if (countryMatch) {
    result.hostCountry = countryMatch.value;
    result.locationLabel = countryMatch.value;
  }

  // 2. City — recorded even when a country was also named ("universities in Munich, Germany").
  const cityMatch = findLongestMatch(lower, CITY_TO_COUNTRY);
  if (cityMatch) {
    // Preserve the user's capitalisation where possible for a natural reply.
    const original = text.match(new RegExp(cityMatch.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    result.city = original ? original[0] : cityMatch.key;
    result.locationLabel = result.city;
    if (!result.hostCountry) {
      result.hostCountry = cityMatch.value;
      result.countryInferredFromCity = true;
    }
  }

  for (const { re, value } of DEGREE_PATTERNS) {
    if (re.test(lower)) {
      result.degreeLevel = value;
      break;
    }
  }

  for (const { re, value } of FUNDING_PATTERNS) {
    if (re.test(lower)) {
      result.fundingType = value;
      break;
    }
  }

  // 3. Residual keywords: drop stopwords, matched location names, and short tokens.
  const consumed = new Set<string>();
  if (countryMatch) countryMatch.key.split(/\s+/).forEach((t) => consumed.add(t));
  if (cityMatch) cityMatch.key.split(/\s+/).forEach((t) => consumed.add(t));

  const keywordTokens = lower
    .replace(/[^a-z0-9\s.+#-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !consumed.has(t))
    // Degree/funding words are already structured filters.
    .filter((t) => !/^(bachelors?|masters?|phd|doctoral|postdoc|funded|funding|full|partial|tuition)$/i.test(t))
    .filter((t) => t.length > 2);

  result.keywords = Array.from(new Set(keywordTokens)).join(' ');

  return result;
}
