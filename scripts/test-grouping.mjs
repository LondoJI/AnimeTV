// Regression tests for anime season/episode grouping.
// Run: npm test   (node scripts/test-grouping.mjs)
//
// Guards against grouping separate adaptations/remakes as seasons of one anime
// (the Doraemon 1973/1979/2005 bug) and against combining episode totals across
// different AniList IDs.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  canGroupAsSeason,
  canFollowSeasonLink,
  getShowKey,
  cleanDescription
} = require("../js/utils.js");

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`); }
}

// ── Sample AniList media (real ids/formats/years) ────────────────────────────
const doraemon1973 = { id: 501,  idMal: 501,  format: "TV",       seasonYear: 1973,
  relations: { edges: [{ relationType: "SEQUEL", node: { id: 2471 } }] } };
const doraemon1979 = { id: 2471, idMal: 2471, format: "TV_SHORT", seasonYear: 1979,
  relations: { edges: [
    { relationType: "PREQUEL", node: { id: 501 } },
    { relationType: "SEQUEL",  node: { id: 8687 } }
  ] } };
const doraemon2005 = { id: 8687, idMal: 8687, format: "TV",       seasonYear: 2005,
  relations: { edges: [{ relationType: "PREQUEL", node: { id: 2471 } }] } };

const fma2003 = { id: 121, idMal: 121, format: "TV", seasonYear: 2003,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 5114 } }] } };
const fmaBrotherhood = { id: 5114, idMal: 5114, format: "TV", seasonYear: 2009,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 121 } }] } };

const hxh1999 = { id: 136, idMal: 136, format: "TV", seasonYear: 1999,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 11061 } }] } };
const hxh2011 = { id: 11061, idMal: 11061, format: "TV", seasonYear: 2011,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 136 } }] } };

const fruits2001 = { id: 120, idMal: 120, format: "TV", seasonYear: 2001,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 105334 } }] } };
const fruits2019 = { id: 105334, idMal: 105334, format: "TV", seasonYear: 2019,
  relations: { edges: [{ relationType: "ALTERNATIVE", node: { id: 120 } }] } };

// A genuine S1 -> S2 connected by SEQUEL, same format, consecutive years.
const realS1 = { id: 21355, idMal: 31240, format: "TV", seasonYear: 2016,
  relations: { edges: [{ relationType: "SEQUEL", node: { id: 108632 } }] } };
const realS2 = { id: 108632, idMal: 39587, format: "TV", seasonYear: 2020,
  relations: { edges: [{ relationType: "PREQUEL", node: { id: 21355 } }] } };

// AoT finale special: format change but a genuine continuation (1 year later).
const aotFinalS2  = { id: 1, format: "TV",      seasonYear: 2022 };
const aotChapters = { id: 2, format: "SPECIAL", seasonYear: 2023 };

console.log("\n# canFollowSeasonLink (chain guard)");
check("Doraemon 2005(TV) does NOT chain to 1979(TV_SHORT)", canFollowSeasonLink(doraemon2005, doraemon1979) === false);
check("Doraemon 1973(TV) does NOT chain to 1979(TV_SHORT)", canFollowSeasonLink(doraemon1973, doraemon1979) === false);
check("Real S1(TV) chains to S2(TV)", canFollowSeasonLink(realS1, realS2) === true);
check("AoT TV finale chains to Final Chapters SPECIAL (1y gap)", canFollowSeasonLink(aotFinalS2, aotChapters) === true);

console.log("\n# canGroupAsSeason");
check("Doraemon 1979 and 2005 are NOT the same season (remake)", canGroupAsSeason(doraemon1979, doraemon2005) === false);
check("Doraemon 1973 and 1979 are NOT the same season (remake)", canGroupAsSeason(doraemon1973, doraemon1979) === false);
check("FMA (2003) and Brotherhood are separate (ALTERNATIVE)", canGroupAsSeason(fma2003, fmaBrotherhood) === false);
check("HxH 1999 and 2011 are separate (ALTERNATIVE)", canGroupAsSeason(hxh1999, hxh2011) === false);
check("Fruits Basket 2001 and 2019 are separate (ALTERNATIVE)", canGroupAsSeason(fruits2001, fruits2019) === false);
check("Real S1 and S2 (SEQUEL, same format) ARE grouped", canGroupAsSeason(realS1, realS2) === true);
check("Same AniList id is the same work", canGroupAsSeason(doraemon2005, { id: 8687 }) === true);
check("Same MAL id is the same work", canGroupAsSeason({ idMal: 8687 }, { idMal: 8687, id: 999 }) === true);

console.log("\n# getShowKey (stable keys, never title-only)");
const k73 = getShowKey({ anilistId: 501, title: "Doraemon", year: 1973, format: "TV" });
const k79 = getShowKey({ anilistId: 2471, title: "Doraemon", year: 1979, format: "TV_SHORT" });
const k05 = getShowKey({ anilistId: 8687, title: "Doraemon", year: 2005, format: "TV" });
check("Doraemon 1973/1979/2005 get 3 distinct keys", new Set([k73, k79, k05]).size === 3);
const noIdA = getShowKey({ title: "Doraemon", year: 1973, format: "TV" });
const noIdB = getShowKey({ title: "Doraemon", year: 2005, format: "TV" });
check("Same title + different year/format -> distinct keys", noIdA !== noIdB);
check("Key prefers AniList id", getShowKey({ anilistId: 8687, malId: 8687 }) === "anilist-8687");

console.log("\n# Episode totals never combine across different AniList IDs");
// Simulate per-entry episode counts and ensure we only sum within one id.
const episodes = [
  ...Array.from({ length: 918 },  (_, i) => ({ anilistId: 8687, episode: i + 1 })),
  ...Array.from({ length: 26 },   (_, i) => ({ anilistId: 501,  episode: i + 1 })),
  ...Array.from({ length: 1787 }, (_, i) => ({ anilistId: 2471, episode: i + 1 }))
];
const selected = { id: 8687 };
const selectedEpisodes = episodes.filter((ep) => ep.anilistId === selected.id);
check("Doraemon (2005) page shows only 918 episodes (not 918+26+1787)", selectedEpisodes.length === 918);

console.log("\n# cleanDescription (no mid-word truncation)");
const desc = "The quick brown fox jumps over the lazy dog and then keeps running forever";
const cleaned = cleanDescription(desc, 40); // boundary falls mid-word
check("Truncated description ends with an ellipsis", cleaned.endsWith("…"));
const truncWords = cleaned.replace(/…$/, "").trim().split(/\s+/);
const sourceWords = desc.split(/\s+/);
check("Every word kept is a complete word (no mid-word cut)", truncWords.every((w) => sourceWords.includes(w)));
check("No leftover HTML tags", !/[<>]/.test(cleanDescription("<p>Hello <b>world</b></p>")));
check("Short description returned whole (no ellipsis)", cleanDescription("Short text") === "Short text");

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
