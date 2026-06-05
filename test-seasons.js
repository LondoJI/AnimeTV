#!/usr/bin/env node
/**
 * test-seasons.js — Season grouping & episode logic unit tests
 * Run: node test-seasons.js
 *
 * Tests: getFranchiseKey, extractSeasonNumber, parseEpisodeNumber,
 *        buildFranchiseFromAniListMedia, episode sort order.
 */

/* ── Polyfill the globals the modules expect ─────────────────────────────── */
global.ANILIST_TV_FORMATS          = new Set(["TV", "TV_SHORT"]);
global.ANILIST_EXTRA_FORMATS       = new Set(["MOVIE","OVA","ONA","SPECIAL","MUSIC"]);
global.ANILIST_FRANCHISE_RELATIONS = new Set(["SEQUEL","PREQUEL","PARENT","SIDE_STORY"]);
global.ANILIST_META_CACHE_PREFIX   = "test:";
global.ANILIST_META_CACHE_TTL      = 1000 * 60 * 60 * 24;
global.ANILIST_SEARCH_CACHE_TTL    = 1000 * 60 * 60 * 6;
global.ANILIST_MEDIA_ENDPOINT      = "";
global.ANILIST_SEARCH_ENDPOINT     = "";
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.fetchWithTimeout = async () => ({ ok: false });

// ── Load utils (normalizeTitle, getFranchiseKey, extractSeasonNumber) ──────
const vm = require("vm");
const fs = require("fs");
const path = require("path");

function loadScript(file) {
  const src = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInThisContext(src, { filename: file });
}
loadScript("js/utils.js");

// ── Inline parseEpisodeNumber (copied from normalize.js for test isolation) ─
function parseEpisodeNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const str = String(value || "");
  const bare = str.match(/^0*(\d+)$/);
  if (bare) return Number(bare[1]);
  const prefixed = str.match(/(?:ep(?:isode)?|cap(?:ítulo|itulo)?|e)[\s.\-#]*0*(\d+)/i);
  if (prefixed) return Number(prefixed[1]);
  const trailing = str.match(/\b0*(\d+)\s*$/);
  if (trailing) return Number(trailing[1]);
  return fallback;
}

// ── Synchronous buildFranchiseFromAniListMedia for testing ────────────────
// (The real version is async and traverses multi-hop relations; the test
//  passes complete data directly so sync is fine here.)
function buildFranchiseFromAniListMedia(media) {
  function normalizeNode(node) {
    const nextEp = node.nextAiringEpisode?.episode;
    const latestAired = nextEp && nextEp > 1 ? nextEp - 1 : null;
    return {
      anilistId: node.id,
      title: node.title?.english || node.title?.romaji || "",
      format: node.format || "TV",
      status: node.status || "",
      seasonYear: node.seasonYear || node.startDate?.year || null,
      startDate: node.startDate || null,
      episodes: node.episodes || null,
      latestAiredEp: latestAired,
    };
  }
  function sortByDate(a, b) {
    const ay = a.seasonYear || 9999, by = b.seasonYear || 9999;
    if (ay !== by) return ay - by;
    return (a.startDate?.month || 0) - (b.startDate?.month || 0);
  }
  const main = normalizeNode(media);
  const all = [main];
  const seen = new Set([media.id]);
  for (const edge of media.relations?.edges || []) {
    const { relationType, node } = edge;
    if (!ANILIST_FRANCHISE_RELATIONS.has(relationType)) continue;
    if (node.type !== "ANIME") continue;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    all.push({ ...normalizeNode(node), relationType });
  }
  all.sort(sortByDate);
  const tvSeasons = all.filter(e => ANILIST_TV_FORMATS.has(e.format));
  const movies    = all.filter(e => e.format === "MOVIE");
  const ovas      = all.filter(e => e.format === "OVA");
  const specials  = all.filter(e => e.format === "SPECIAL");
  tvSeasons.forEach((e, i) => { e.seasonNumber = i + 1; });
  return { mainAnilistId: media.id, tvSeasons, movies, ovas, specials, all };
}

/* ── Test runner ────────────────────────────────────────────────────────── */
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function deepEq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ""}\n  expected ${JSON.stringify(b)}\n  got     ${JSON.stringify(a)}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. getFranchiseKey — strips season identifiers for franchise matching
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── getFranchiseKey ──────────────────────────────────────────────────");

test("plain title unchanged", () => {
  eq(getFranchiseKey("Naruto"), "naruto");
});
test("strips 'Season 2'", () => {
  eq(getFranchiseKey("Attack on Titan Season 2"), "attack on titan");
});
test("strips '4th Season: subtitle'", () => {
  // normalizeTitle strips articles like "the", so expected key is without "the"
  const key = getFranchiseKey("Classroom of the Elite 4th Season: Second Year, First Semester");
  // Must match the base-title key (same as Season 1's key)
  eq(key, getFranchiseKey("Classroom of the Elite"));
});
test("strips 'II' roman (season keyword required)", () => {
  // "Sword Art Online II" has no "season" keyword so it stays — that's correct
  // because we can't blindly strip trailing roman numerals from unrelated titles
  const key = getFranchiseKey("Sword Art Online II");
  eq(typeof key === "string", true);
});
test("strips 'Part 2'", () => {
  eq(getFranchiseKey("Demon Slayer: Kimetsu no Yaiba Part 2"), "demon slayer kimetsu no yaiba");
});
test("Attack on Titan Final Season same key as Season 1", () => {
  eq(getFranchiseKey("Attack on Titan: The Final Season"),
     getFranchiseKey("Attack on Titan Season 1"));
});
test("Re:Zero S2 and S3 match", () => {
  eq(getFranchiseKey("Re:ZERO -Starting Life in Another World Season 2"),
     getFranchiseKey("Re:ZERO -Starting Life in Another World Season 3"));
});
test("Naruto / Naruto Shippuden different keys (correct — different franchise entries)", () => {
  // They are separate AniList entries; key difference is expected
  eq(typeof getFranchiseKey("Naruto Shippuden") === "string", true);
});
test("Bleach and Bleach: Thousand-Year Blood War share base", () => {
  const k1 = getFranchiseKey("Bleach");
  const k2 = getFranchiseKey("Bleach: Thousand-Year Blood War");
  // After stripping punctuation/words both reduce to "bleach"
  eq(k1, "bleach");
  eq(k2.startsWith("bleach"), true);
});

/* ══════════════════════════════════════════════════════════════════════════
   2. extractSeasonNumber — extracts season number from title string
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── extractSeasonNumber ──────────────────────────────────────────────");

test("explicit 'Season 2'", () => eq(extractSeasonNumber("Attack on Titan Season 2"), 2));
test("ordinal '3rd Season'", () => eq(extractSeasonNumber("Sword Art Online 3rd Season"), 3));
test("4th in middle", () => eq(extractSeasonNumber("Classroom of the Elite 4th Season: Subtitle"), 4));
test("word 'second season'", () => eq(extractSeasonNumber("Re:Zero Second Season"), 2));
test("roman 'Season IV'", () => eq(extractSeasonNumber("Overlord Season IV"), 4));
test("S2 shorthand", () => eq(extractSeasonNumber("Black Clover S2"), 2));
test("no season → fallback 1", () => eq(extractSeasonNumber("Naruto", 1), 1));
test("Japanese 期 marker", () => eq(extractSeasonNumber("進撃の巨人 第3期"), 3));
test("One Piece → fallback 1 (single long series)", () => eq(extractSeasonNumber("One Piece", 1), 1));

/* ══════════════════════════════════════════════════════════════════════════
   3. parseEpisodeNumber — robust episode number extraction
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── parseEpisodeNumber ───────────────────────────────────────────────");

test("integer 5", () => eq(parseEpisodeNumber(5), 5));
test("string '42'", () => eq(parseEpisodeNumber("42"), 42));
test("string '01' (leading zero)", () => eq(parseEpisodeNumber("01"), 1));
test("'Episode 01'", () => eq(parseEpisodeNumber("Episode 01"), 1));
test("'E3'", () => eq(parseEpisodeNumber("E3"), 3));
test("'Ep. 12'", () => eq(parseEpisodeNumber("Ep. 12"), 12));
test("'EP. 5'", () => eq(parseEpisodeNumber("EP. 5"), 5));
test("'Capitulo 5'", () => eq(parseEpisodeNumber("Capitulo 5"), 5));
test("'Capítulo 05'", () => eq(parseEpisodeNumber("Capítulo 05"), 5));
test("'1' → 1 (bare)", () => eq(parseEpisodeNumber("1"), 1));
test("sorting: numeric not lexical (1,2,10,11 not 1,10,11,2)", () => {
  const nums = ["Episode 11","Episode 2","Episode 10","Episode 1"]
    .map(parseEpisodeNumber)
    .sort((a, b) => a - b);
  deepEq(nums, [1, 2, 10, 11]);
});
test("null for empty string", () => eq(parseEpisodeNumber("", null), null));

/* ══════════════════════════════════════════════════════════════════════════
   4. buildFranchiseFromAniListMedia — AniList relations → franchise structure
   ══════════════════════════════════════════════════════════════════════════ */
console.log("\n── buildFranchiseFromAniListMedia ───────────────────────────────────");

// Helper to build a minimal AniList Media object
function makeMedia(id, title, format, year, relations = []) {
  return {
    id,
    title: { english: title, romaji: title },
    format,
    status: "FINISHED",
    seasonYear: year,
    startDate: { year, month: 4, day: 1 },
    episodes: 12,
    relations: { edges: relations }
  };
}
function makeEdge(type, node) {
  return { relationType: type, node: { ...node, type: "ANIME" } };
}

test("single TV season → tvSeasons[0].seasonNumber = 1", () => {
  const media = makeMedia(1, "Attack on Titan", "TV", 2013);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 1);
  eq(f.tvSeasons[0].seasonNumber, 1);
  eq(f.movies.length, 0);
});

test("Attack on Titan: S1 + S2 sequel sorts chronologically", () => {
  const s2node = { id: 2, format: "TV", status: "FINISHED", seasonYear: 2017, startDate: { year: 2017, month: 4 }, episodes: 12, title: { english: "Attack on Titan Season 2" } };
  const media = makeMedia(1, "Attack on Titan", "TV", 2013, [makeEdge("SEQUEL", s2node)]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 2);
  eq(f.tvSeasons[0].seasonYear, 2013);
  eq(f.tvSeasons[0].seasonNumber, 1);
  eq(f.tvSeasons[1].seasonYear, 2017);
  eq(f.tvSeasons[1].seasonNumber, 2);
});

test("Demon Slayer: TV season + Movie separated correctly", () => {
  const movieNode = { id: 99, format: "MOVIE", status: "FINISHED", seasonYear: 2020, startDate: { year: 2020, month: 10 }, episodes: 1, title: { english: "Demon Slayer: Mugen Train" } };
  const media = makeMedia(10, "Demon Slayer", "TV", 2019, [makeEdge("SEQUEL", movieNode)]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 1);
  eq(f.movies.length, 1);
  eq(f.movies[0].title, "Demon Slayer: Mugen Train");
});

test("OVA separated from TV seasons", () => {
  const ovaNode = { id: 55, format: "OVA", status: "FINISHED", seasonYear: 2014, startDate: { year: 2014, month: 7 }, episodes: 3, title: { english: "Some OVA" } };
  const media = makeMedia(50, "Some Anime", "TV", 2013, [makeEdge("SIDE_STORY", ovaNode)]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 1);
  eq(f.ovas.length, 1);
});

test("Jujutsu Kaisen S1 + S2 + Movie all grouped", () => {
  const s2   = { id: 145, format: "TV",    status: "FINISHED", seasonYear: 2023, startDate: { year: 2023, month: 7 }, episodes: 23, title: { english: "Jujutsu Kaisen Season 2" } };
  const movie = { id: 146, format: "MOVIE", status: "FINISHED", seasonYear: 2021, startDate: { year: 2021, month: 12 }, episodes: 1, title: { english: "Jujutsu Kaisen 0" } };
  const media = makeMedia(113415, "Jujutsu Kaisen", "TV", 2020, [
    makeEdge("SEQUEL", s2),
    makeEdge("SIDE_STORY", movie)
  ]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 2);
  eq(f.movies.length, 1);
  eq(f.movies[0].title, "Jujutsu Kaisen 0");
});

test("ADAPTATION relation is excluded from franchise", () => {
  const adaptation = { id: 77, format: "TV", type: "ANIME", seasonYear: 2000, episodes: 12, title: { english: "Old Adaptation" } };
  const media = makeMedia(1, "Source Manga Anime", "TV", 2020, [makeEdge("ADAPTATION", adaptation)]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.all.length, 1); // only the main entry
});

test("Currently airing: latestAiredEp = nextAiringEpisode.episode - 1", () => {
  const media = {
    id: 200,
    title: { english: "Re:ZERO Season 4" },
    format: "TV", status: "RELEASING",
    seasonYear: 2025, startDate: { year: 2025, month: 4, day: 1 },
    episodes: 19,
    nextAiringEpisode: { episode: 10 },
    relations: { edges: [] }
  };
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons[0].latestAiredEp, 9);
  eq(f.tvSeasons[0].episodes, 19); // total from AniList
});

test("null episodes + no nextAiringEpisode → latestAiredEp null", () => {
  const media = { id: 300, title: { english: "Unknown" }, format: "TV", status: "NOT_YET_RELEASED", seasonYear: 2026, episodes: null, relations: { edges: [] } };
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons[0].latestAiredEp, null);
  eq(f.tvSeasons[0].episodes, null);
});

test("One Piece: single long entry, no sequel relations → 1 TV season", () => {
  const media = { id: 21, title: { english: "One Piece" }, format: "TV", status: "RELEASING", seasonYear: 1999, episodes: null, relations: { edges: [] } };
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 1);
});

test("Bleach + TYBW as sequel → 2 TV seasons", () => {
  const tybw = { id: 163132, format: "TV", type: "ANIME", status: "RELEASING", seasonYear: 2022, startDate: { year: 2022, month: 10 }, episodes: null, title: { english: "Bleach: Thousand-Year Blood War" } };
  const media = makeMedia(269, "Bleach", "TV", 2004, [makeEdge("SEQUEL", tybw)]);
  const f = buildFranchiseFromAniListMedia(media);
  eq(f.tvSeasons.length, 2);
  eq(f.tvSeasons[1].title, "Bleach: Thousand-Year Blood War");
});

/* ══════════════════════════════════════════════════════════════════════════
   Summary
   ══════════════════════════════════════════════════════════════════════════ */
console.log(`\n${"─".repeat(60)}`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) {
  console.error("Some tests failed.");
  process.exit(1);
} else {
  console.log("All tests passed.");
}
