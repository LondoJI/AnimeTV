import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE_URL = "https://www.underhentai.net";
const CATALOG = resolve("scraper", "underhentai_catalog.json");
const OUTPUT = resolve("scraper", "underhentai_details.json");
const TITLE_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.UNDERHENTAI_DETAIL_CONCURRENCY || 3)));
const WATCH_CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.UNDERHENTAI_WATCH_CONCURRENCY || 3)));
const USER_AGENT = "Mozilla/5.0 (compatible; ZenkaiTVAdultCatalog/1.0)";
const EMBED_URL_RE = /https:\/\/(?:www\.)?(?:krakenfiles\.com\/embed-video|luluvdo\.com\/embed|lulustream\.com\/embed)\/[A-Za-z0-9_-]+/gi;

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value = "") {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function attr(tag = "", name = "") {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

function normalizeImageUrl(value = "") {
  if (!value) return "";
  const url = new URL(value, BASE_URL);
  const wasPageSpeed = /\.pagespeed\./i.test(url.pathname);
  let path = url.pathname.replace(/\.pagespeed\.[^/]+$/i, "");
  let file = path.split("/").pop() || "";
  file = file.replace(/^\d+x\d+x/i, "");
  if (wasPageSpeed && file.startsWith("x")) file = file.slice(1);
  url.pathname = `${path.slice(0, Math.max(0, path.lastIndexOf("/") + 1))}${file}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: BASE_URL
        },
        redirect: "follow",
        signal: controller.signal
      });
      if (response.ok) return await response.text();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * (attempt + 1)));
  }
  throw lastError || new Error(`Could not fetch ${url}`);
}

async function mapConcurrent(items, concurrency, worker, label) {
  const result = new Array(items.length);
  let next = 0;
  let completed = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        result[index] = await worker(items[index], index);
      } catch (error) {
        console.warn(`${label} failed for ${items[index]?.url || items[index]?.watchUrl || index}: ${error.message}`);
        result[index] = null;
      }
      completed += 1;
      if (completed % 50 === 0 || completed === items.length) {
        console.log(`${label} ${completed}/${items.length}`);
      }
    }
  });
  await Promise.all(runners);
  return result;
}

function parseTitlePage(html, catalogItem) {
  const sectionMatches = [...html.matchAll(/class\s*=\s*(?:"ep2-header"|'ep2-header'|ep2-header)[^>]*>([\s\S]*?)<\/div>/gi)];
  const episodes = sectionMatches.map((header, sectionIndex) => {
    const number = Number(stripHtml(header[1]).match(/(\d+)/)?.[1] || sectionIndex + 1);
    const sectionStart = header.index + header[0].length;
    const sectionEnd = sectionMatches[sectionIndex + 1]?.index ?? html.length;
    const section = html.slice(sectionStart, sectionEnd);
    const screenshots = [...section.matchAll(/\bdata-src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)]
      .map((match) => normalizeImageUrl(match[1] || match[2] || match[3] || ""))
      .filter(Boolean);
    const streamTags = [...section.matchAll(/<a\b[^>]*class\s*=\s*(?:"[^"]*\bep2-stream\b[^"]*"|'[^']*\bep2-stream\b[^']*'|ep2-stream)[^>]*>/gi)];
    const sourceOptions = streamTags.map((stream, releaseIndex) => {
      const before = section.slice(0, stream.index);
      const cardStart = Math.max(
        before.lastIndexOf('class="ep2-card'),
        before.lastIndexOf("class='ep2-card"),
        before.lastIndexOf("class=ep2-card")
      );
      const card = before.slice(Math.max(0, cardStart));
      const variant = stripHtml(
        card.match(/class\s*=\s*(?:"ep2-vtype"|'ep2-vtype'|ep2-vtype)[^>]*>(?:\s*<span\b[^>]*>[\s\S]*?<\/span>)?\s*([^<]+)/i)?.[1]
        || "Stream"
      );
      const metadata = {};
      for (const pair of card.matchAll(/class\s*=\s*(?:"ep2-meta-label"|'ep2-meta-label'|ep2-meta-label)[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class\s*=\s*(?:"ep2-meta-value"|'ep2-meta-value'|ep2-meta-value)[^>]*>([\s\S]*?)<\/span>/gi)) {
        metadata[stripHtml(pair[1]).toLowerCase()] = stripHtml(pair[2]).replace(/^[^A-Za-z0-9]+/, "");
      }
      const watchUrl = new URL(attr(stream[0], "href"), catalogItem.url).toString();
      return {
        releaseIndex,
        label: [variant, metadata.subs, metadata.audio].filter(Boolean).join(" · ") || `Stream ${releaseIndex + 1}`,
        variant,
        format: metadata.format || "",
        size: metadata.size || "",
        subtitles: metadata.subs || "",
        audio: metadata.audio || "",
        watchUrl,
        embeds: []
      };
    });
    return {
      episode: number,
      number,
      title: `Episode ${number}`,
      image: screenshots[0] || catalogItem.banner || catalogItem.image,
      screenshots,
      sourceOptions,
      locked: !sourceOptions.length
    };
  });

  return {
    ...catalogItem,
    banner: episodes.find((episode) => episode.image)?.image || catalogItem.banner || catalogItem.image,
    episodeCount: episodes.length || catalogItem.episodeCount || 0,
    episodes
  };
}

function parseEmbeds(html = "") {
  const embeds = [];
  for (const match of String(html).matchAll(EMBED_URL_RE)) {
    const url = match[0].replace(/^https:\/\/www\./i, "https://");
    if (!embeds.includes(url)) embeds.push(url);
  }
  return embeds;
}

function hasDirectEmbed(sourceOption = {}) {
  return Array.isArray(sourceOption.embeds)
    && sourceOption.embeds.some((embed) => /krakenfiles\.com\//i.test(String(embed)));
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  let existing = { items: [] };
  try {
    existing = JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    // First build.
  }
  const existingBySlug = new Map((existing.items || []).map((item) => [item.slug, item]));
  const missingItems = items.filter((item) => !existingBySlug.has(item.slug));
  console.log(`Loading ${missingItems.length} missing detail pages for ${items.length} eligible titles.`);

  const parsed = await mapConcurrent(
    missingItems,
    TITLE_CONCURRENCY,
    async (item) => parseTitlePage(await fetchText(item.url), item),
    "Title pages"
  );
  const parsedBySlug = new Map(parsed.filter(Boolean).map((item) => [item.slug, item]));
  const details = items
    .map((item) => existingBySlug.get(item.slug) || parsedBySlug.get(item.slug))
    .filter(Boolean);
  const jobs = [];
  details.forEach((item) => {
    item.episodes.forEach((episode) => {
      episode.sourceOptions.forEach((sourceOption) => {
        if (!sourceOption.embeds?.length) jobs.push({ item, episode, sourceOption });
      });
    });
  });
  console.log(`Resolving ${jobs.length} release routes that still need playback.`);

  await mapConcurrent(
    jobs,
    WATCH_CONCURRENCY,
    async (job) => {
      try {
        job.sourceOption.embeds = parseEmbeds(await fetchText(job.sourceOption.watchUrl));
      } catch {
        job.sourceOption.embeds = [];
      }
      return job.sourceOption.embeds.length;
    },
    "Watch pages"
  );

  const allSourceOptions = details.flatMap((item) => item.episodes.flatMap((episode) => episode.sourceOptions));
  const allEpisodes = details.flatMap((item) => item.episodes);
  const payload = {
    source: "UnderHentai",
    generatedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.generatedAt || null,
    count: details.length,
    releaseCount: allSourceOptions.length,
    playableReleaseCount: allSourceOptions.filter(hasDirectEmbed).length,
    episodeCount: allEpisodes.length,
    playableEpisodeCount: allEpisodes.filter((episode) => episode.sourceOptions.some(hasDirectEmbed)).length,
    items: details
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Saved ${payload.count} titles and ${payload.playableEpisodeCount}/${payload.episodeCount} playable episodes to ${OUTPUT}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
