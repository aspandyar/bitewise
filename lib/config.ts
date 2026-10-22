// Every tunable number in the app lives here so formulas stay free of magic values.

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

// Mifflin-St Jeor: BMR = weight × 10 + height × 6.25 − age × 5 + sex constant.
export const MIFFLIN_ST_JEOR = {
  kcalPerKg: 10,
  kcalPerCm: 6.25,
  kcalPerYear: 5,
  sexConstantKcal: {
    male: 5,
    female: -161,
  },
} as const satisfies {
  kcalPerKg: number;
  kcalPerCm: number;
  kcalPerYear: number;
  sexConstantKcal: Record<Sex, number>;
};

// Tuples double as Postgres enum values and zod enum options, so the DB and forms cannot drift.
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "veryActive"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

// TDEE = BMR × factor.
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
} as const satisfies Record<ActivityLevel, number>;

export const GOALS = ["lose", "maintain", "gain"] as const;
export type Goal = (typeof GOALS)[number];

// Daily target kcal = TDEE × (1 + adjustment).
export const GOAL_ADJUSTMENTS = {
  lose: -0.15,
  maintain: 0,
  gain: 0.1,
} as const satisfies Record<Goal, number>;

// Ordered by privilege. "admin" is only ever granted by the bootstrap script, never by the app.
export const USER_ROLES = ["user", "manager", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TARGET_MODES = ["auto", "manual"] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

// Midpoints of the common ranges (1.6–2.0 g/kg protein, 25–30 % fat).
export const MACRO_TARGETS = {
  proteinGPerKg: 1.8,
  fatShareOfKcal: 0.27,
} as const;

export const KCAL_PER_GRAM = {
  protein: 4,
  fat: 9,
  carbs: 4,
  // Fermentable fiber; Russian labels list carbs net of it, so it is counted on its own.
  fiber: 2,
} as const;

// An own food's kcal is flagged (never refused) when it misses the Atwater estimate by more than
// both bounds. Tuned on the seed: only cocoa powder, dry wine and beer (alcohol) are flagged, while
// a dropped digit (31 for 313) always is; the absolute floor spares near-zero foods like coffee.
export const KCAL_CHECK = {
  maxShareOff: 0.2,
  minKcalOff: 20,
} as const;

// Plausible human ranges: wider would let typos (1800 cm) through, narrower would reject real people.
export const PROFILE_LIMITS = {
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  ageYears: { min: 14, max: 100 },
} as const;

export const TARGET_LIMITS = {
  kcal: { min: 800, max: 6000 },
  macroG: { min: 0, max: 1000 },
} as const;

export const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const SECONDS_PER_DAY = 86_400;

export const AUTH = {
  passwordLength: { min: 8, max: 128 },
  sessionMaxAgeSec: 30 * SECONDS_PER_DAY,
  // Error code authorize throws when the hashing queue is full; the login form maps it to
  // "too many attempts" instead of "wrong password" (#104).
  busySignInError: "busy",
  // The cookie that marks a browser the account signed in from (#30): its attempts skip the
  // per-account lockout, which strangers guessing the password would otherwise trigger.
  deviceCookie: "bw-device",
  deviceMaxAgeSec: 365 * SECONDS_PER_DAY,
} as const;

// A key the client adds to every submit (#95): when a response is lost and Next replays the
// request, the server finds the row the first one made instead of writing a second.
export const REQUEST_ID = {
  field: "requestId",
  // The user signed in when the form was sent: a replay sent after signing in as someone else
  // is refused instead of writing into the other account (#107). The value comes from a cookie
  // the latest rendered page sets, shared by all tabs, so an old tab is never stuck on a user.
  userField: "requestUser",
  userCookie: "bw-uid",
} as const;

// Used until the browser reports its own zone through the cookie (first visit, JS off).
export const DEFAULT_TIME_ZONE = "Asia/Almaty";

export const TIME_ZONE_COOKIE = {
  name: "tz",
  maxAgeSec: 365 * SECONDS_PER_DAY,
  // IANA names are at most ~30 characters; longer values are garbage, not a zone.
  maxLength: 64,
} as const;

// The health check answers within this or reports the database as down.
export const HEALTH = { timeoutMs: 2000 } as const;

// How deep the log scrubber follows error causes; a cycle or a pathological chain stops here.
export const LOG_SCRUB = { maxDepth: 5 } as const;

// One policy for every environment. 'unsafe-inline' scripts: Next injects per-request inline
// scripts that a hash cannot cover, and a nonce would make every screen request-time (#18).
export const SECURITY_HEADERS = {
  csp: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  },
  // The camera is for the barcode scanner (stage 7); nothing else is ever asked for.
  permissions: { camera: "(self)", microphone: "()", geolocation: "()" },
} as const;

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

// "graphite" is the original black-and-white look: anyone who never opens the setting sees no change.
export const ACCENTS = ["graphite", "green", "blue", "violet", "orange", "pink"] as const;
export type Accent = (typeof ACCENTS)[number];

export type ColorMode = "light" | "dark";

// Each accent has a shade per theme so text on a button and links on the page both stay readable;
// a test holds every pair to minContrast (WCAG AA for body text). Red is left out: it means
// "over target" and errors.
export const APPEARANCE = {
  // Prefixed: cookies are not separated by port, and "theme" is a common name on localhost.
  cookies: { theme: "bw-theme", accent: "bw-accent" },
  maxAgeSec: 365 * SECONDS_PER_DAY,
  // Marks the theme-color meta the head script adds for a forced theme before React hydrates;
  // the server's own metas are left alone, since React matches them by content (#97).
  earlyThemeColorAttr: "data-early",
  defaults: { theme: "system", accent: "graphite" },
  base: {
    light: { background: "#ffffff", foreground: "#171717" },
    dark: { background: "#0a0a0a", foreground: "#ededed" },
  },
  accents: {
    graphite: {
      light: { accent: "#171717", onAccent: "#ffffff" },
      dark: { accent: "#ededed", onAccent: "#0a0a0a" },
    },
    green: {
      light: { accent: "#15803d", onAccent: "#ffffff" },
      dark: { accent: "#4ade80", onAccent: "#0a0a0a" },
    },
    blue: {
      light: { accent: "#1d4ed8", onAccent: "#ffffff" },
      dark: { accent: "#60a5fa", onAccent: "#0a0a0a" },
    },
    violet: {
      light: { accent: "#6d28d9", onAccent: "#ffffff" },
      dark: { accent: "#a78bfa", onAccent: "#0a0a0a" },
    },
    orange: {
      light: { accent: "#c2410c", onAccent: "#ffffff" },
      dark: { accent: "#fb923c", onAccent: "#0a0a0a" },
    },
    pink: {
      light: { accent: "#be185d", onAccent: "#ffffff" },
      dark: { accent: "#f472b6", onAccent: "#0a0a0a" },
    },
  },
  minContrast: 4.5,
} as const satisfies {
  cookies: { theme: string; accent: string };
  maxAgeSec: number;
  earlyThemeColorAttr: string;
  defaults: { theme: Theme; accent: Accent };
  base: Record<ColorMode, { background: string; foreground: string }>;
  accents: Record<Accent, Record<ColorMode, { accent: string; onAccent: string }>>;
  minContrast: number;
};

export const PWA = {
  // The icon background and the splash screen behind it.
  brandColor: "#171717",
  markColor: "#ffffff",
  iconSizes: [192, 512],
  appleIconSize: 180,
  faviconSize: 32,
  // Android crops maskable icons to a circle of 80 % of the side; the mark shrinks to stay inside.
  maskableScale: 0.7,
  iconsPath: "/pwa-icons",
  offlinePath: "/offline",
  serviceWorkerPath: "/sw.js",
  // Where the head script parks a beforeinstallprompt that fires before React hydrates.
  installPromptGlobal: "__bitewiseInstallPrompt",
  // The worker's cache is "<prefix>-<hash of what it precaches>": a changed offline page or icon
  // setting renames it, and the worker deletes caches with any other name (#96).
  cachePrefix: "bitewise",
  cacheHashLength: 12,
  // The offline page carries its own CSS; its retry button keeps the app's 44 px tap target.
  offlineTapPx: 44,
} as const;

// OWASP scrypt profile (N=2^15, r=8, p=3): ~32 MB per hash keeps a small VPS responsive.
export const PASSWORD_HASH = {
  N: 2 ** 15,
  r: 8,
  p: 3,
  keyLength: 64,
  saltBytes: 16,
  maxmemBytes: 64 * 1024 * 1024,
  // Two hashes at once keep a 1–2 GB VPS responsive; past the queue sign-ins fail fast (#20).
  maxConcurrent: 2,
  maxQueued: 20,
} as const;

// ~100 bytes per key, so the cap costs ~10 MB; reaching it takes a botnet, not one script.
export const RATE_LIMITS = {
  login: { max: 10, windowMs: 15 * MS_PER_MINUTE, maxKeys: 100_000 },
  register: { max: 5, windowMs: 60 * MS_PER_MINUTE, maxKeys: 100_000 },
  // Search fires on every typed letter after a debounce; 2 per second is far above human typing.
  foodSearch: { max: 120, windowMs: MS_PER_MINUTE, maxKeys: 100_000 },
  // Every server action that writes, per user (#31): a person tapping "+" fast stays far below,
  // a script creating and deleting rows in a loop does not.
  write: { max: 60, windowMs: MS_PER_MINUTE, maxKeys: 100_000 },
  // Guesses at the current password from a signed-in session, per account (#29).
  passwordChange: { max: 5, windowMs: 15 * MS_PER_MINUTE, maxKeys: 100_000 },
  // Scans per user: a person scanning a shopping bag stays far below, a script trying codes does not.
  barcodeLookup: { max: 30, windowMs: MS_PER_MINUTE, maxKeys: 100_000 },
  // Calls to Open Food Facts from this process, all users together; they allow 15 product reads
  // a minute per IP, and our own users must never get the server's IP blocked there.
  offOutbound: { max: 10, windowMs: MS_PER_MINUTE, maxKeys: 1 },
} as const;

// Number of reverse proxies we control in front of the app (nginx, stage 6). Each one appends the
// peer it saw to X-Forwarded-For, so the client IP sits that many entries from the right.
export const TRUSTED_PROXY_HOPS = 1;

// Where a food's numbers come from; shown as a badge in search. "ai_estimate" arrives with its
// own stage through a migration.
export const FOOD_SOURCES = ["user", "usda", "label", "off"] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];
// Only these come from the seed file, so only these may be retired when a key leaves it: shared
// foods cached from Open Food Facts were never in the file.
export const SEED_FOOD_SOURCES = ["usda", "label"] as const;

// Per 100 g: pure fat is ~900 kcal, and no 100 g of food holds more than 100 g of nutrients.
export const FOOD_LIMITS = {
  nameLength: { min: 1, max: 100 },
  kcal100: { min: 0, max: 900 },
  nutrient100G: { min: 0, max: 100 },
  maxTotalGramsPer100G: 100,
  // Far above any real personal list; bounds what one account can add to the shared search index.
  maxOwnFoods: 1000,
} as const;

export const PORTION_LIMITS = {
  labelLength: { min: 1, max: 40 },
  grams: { min: 0.1, max: 5000 },
  // Keeps a portion list scannable on a phone screen.
  maxOwnPerFood: 20,
} as const;

// GTIN lengths a pack can carry: EAN-8, UPC-A, EAN-13, GTIN-14.
export const BARCODE = { lengths: [8, 12, 13, 14] } as const;

// Open Food Facts product API v2. They ask every app for its own User-Agent ("AppName/Version
// (contact)"); the version comes from package.json in lib/foods/off.ts.
export const OFF = {
  productUrl: "https://world.openfoodfacts.org/api/v2/product/",
  productPageUrl: "https://world.openfoodfacts.org/product/",
  fields: [
    "code",
    "product_name",
    "product_name_ru",
    "generic_name",
    "generic_name_ru",
    "brands",
    "serving_quantity",
    "nutriments",
  ],
  appName: "Bitewise",
  contactUrl: "https://github.com/aspandyar/bitewise",
  // A scan waits on this before the user sees anything; their API answers in well under a second.
  timeoutMs: 4000,
  kjPerKcal: 4.184,
} as const;

export const FOOD_SEARCH = {
  limit: 20,
  maxQueryLength: 50,
  // A search screen opened with ?q= starts from that query: "Back" from a new food returns to it.
  queryParam: "q",
  // Trigrams carry no signal below 3 letters; shorter queries match word starts only.
  minTrigramLength: 3,
  // pg_trgm word_similarity cut-off, tuned on real typos: "грчка" → "гречка" scores 0.44 and
  // "гречко" 0.71, while the unrelated "гречко" → "молоко" scores 0.14.
  wordSimilarityThreshold: 0.4,
  // A fuzzy match must also pass strict_word_similarity, which compares whole words: it keeps
  // typos ("малоко" → "молоко" 0.40, "грчка" 0.44, "кура" → "куриный" 0.30) and drops look-alikes
  // that word_similarity lets through ("борщ" → "перец" 0.14, "рис" → "рикотта" 0.20,
  // "малоко" → "малина" 0.27, "кура" → "кукуруза" 0.27).
  strictWordSimilarityThreshold: 0.28,
  debounceMs: 250,
} as const;

// Foods store nutrients per this many grams; every entry scales from it.
export const NUTRIENT_BASE_GRAMS = 100;

// Order here is the order on the day screen and in the Postgres enum (ORDER BY follows it).
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export const DIARY_LIMITS = {
  // Same bounds as a food portion: from a pinch of salt to a big pot. A food without portions
  // opens on the default, selected: one tap adds it, typing replaces it.
  grams: { min: 0.1, max: 5000, default: 100 },
  // Quarter portions are the finest split people use; the stepper moves in whole portions
  // ("2 шт", "3 шт"), and fractions are typed.
  portionCount: { min: 0.25, max: 50, step: 1, default: 1 },
  // Far above any real day; bounds what a script can write into one day.
  maxEntriesPerDay: 100,
  // ~27 years at 10 entries a day; stops a script sweeping every allowed date to fill the disk.
  maxEntriesTotal: 100_000,
  // Older dates are typos, not history kept in this app.
  minDate: "2000-01-01",
} as const;

export const QUICK = {
  // Enough for a week of breakfasts without scrolling on a phone.
  recentLimit: 8,
  // Recent foods are picked from this many latest entries: weeks of eating, one cheap query.
  recentScanEntries: 500,
  maxFavorites: 100,
  // Long enough to notice a wrong tap and undo it, short enough not to cover the day for long.
  undoMs: 5000,
  // "Отменить" deletes only entries this fresh: a crafted ?undo= link cannot wipe older history.
  // Wider than undoMs to cover a slow network and a server action round trip.
  undoWindowMs: 120_000,
  // The repeat button names this many foods, then "и ещё N", to stay on one line at 375 px.
  repeatNames: 2,
  // One "just kcal" entry; more is a typo, not a meal.
  kcal: { min: 1, max: 5000 },
} as const;

// "В дневник" from a dish picks the meal by the hour in the user's zone.
export const MEAL_BY_HOUR = [
  { untilHour: 11, meal: "breakfast" },
  { untilHour: 16, meal: "lunch" },
  { untilHour: 21, meal: "dinner" },
] as const satisfies readonly { untilHour: number; meal: Meal }[];
export const LATE_MEAL: Meal = "snack";

export const RECIPE_LIMITS = {
  // Keeps the ingredient list scannable on a phone; real dishes rarely pass 20.
  maxItems: 50,
  // A big soup pot is ~10 kg; 20 kg leaves room without letting typos like 300 000 through.
  cookedWeightG: { min: 0.1, max: 20_000 },
  servings: { min: 1, max: 100 },
} as const;

// A confirmation after a redirect travels in this query parameter and hides after a few seconds.
export const TOAST_PARAM = "toast";
// Entries a quick add or a repeat just created, so the toast can offer to undo them.
export const UNDO_PARAM = "undo";
export const TOAST_DURATION_MS = 3000;
// A toast raised in the browser without a navigation (the appearance picker, #97).
export const TOAST_EVENT = "bitewise:toast";

// Credited on the foods screen: the seed's shared foods come from there (public domain).
export const USDA_FDC_URL = "https://fdc.nal.usda.gov/";

// FoodData Central nutrient ids (nutrient.csv), all per 100 g.
export const USDA_NUTRIENT_IDS = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbsByDifference: 1005,
  fiber: 1079,
} as const;

// Matches numeric(8,2): seed values are rounded to what the column stores, so diffs stay stable.
export const NUTRIENT_STORAGE_DECIMALS = 2;
export const NUTRIENT_STORAGE_SCALE = 10 ** NUTRIENT_STORAGE_DECIMALS;
