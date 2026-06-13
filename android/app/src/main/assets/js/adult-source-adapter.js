/**
 * ZenkaiTV AdultSourceAdapter
 *
 * A pluggable interface for an 18+ content source, shaped to match the existing
 * AnimeAV1 scraper (login / search / getDetails). This file intentionally
 * Adult providers stay behind the explicit 18+ mode gate and are never merged
 * into the regular catalog surface.
 *
 * Contract (mirror of the AnimeAV1 scraper):
 *
 *   class AnimeAV1Scraper {
 *     login(email, password): Promise<boolean>
 *     search(query, page=1):  Promise<ContentItem[]>   // { id, title, thumbnail, url }
 *     getDetails(id):         Promise<ContentDetails | null>
 *   }
 *
 * ContentItem  (what search/listLatest return — flagged so AdultMode filters it):
 *   { id, title, thumbnail, url, isAdult: true, adultSource: <name> }
 *
 * ContentDetails (what getDetails returns):
 *   { id, title, description, thumbnail, episodes: [{ number, title, url }], isAdult: true }
 */
class AdultSourceAdapter {
  /**
   * @param {object} config - e.g. { name, baseUrl, credentials }
   */
  constructor(config = {}) {
    this.name = config.name || "adult-source";
    this.baseUrl = config.baseUrl || "";
    this.config = config;
    this._session = null;
  }

  /**
   * Authenticate, if your source needs it (the AnimeAV1 scraper logs in here).
   * @returns {Promise<boolean>} true on success.
   */
  async login(email, password) {
    // TODO: Implement with your adult source.
    // e.g. POST credentials, store a session cookie/token on `this._session`.
    void email; void password;
    throw new Error(`AdultSourceAdapter[${this.name}].login is not implemented`);
  }

  /**
   * Search the source. MUST return items flagged `isAdult: true` so the rest of
   * the app keeps them out of the default catalog.
   * @returns {Promise<Array<{id,title,thumbnail,url,isAdult:boolean,adultSource:string}>>}
   */
  async search(query, page = 1) {
    // TODO: Implement with your adult source.
    // Return [{ id, title, thumbnail, url, isAdult: true, adultSource: this.name }, ...]
    void query; void page;
    return [];
  }

  /**
   * Newest releases for the home rail (optional; mirrors AnimeAV1 "latest").
   * @returns {Promise<Array<object>>}
   */
  async listLatest(page = 1) {
    // TODO: Implement with your adult source.
    void page;
    return [];
  }

  /**
   * Full details for one item (episodes/streams).
   * @returns {Promise<object|null>}
   */
  async getDetails(id) {
    // TODO: Implement with your adult source.
    // Return { id, title, description, thumbnail, episodes: [...], isAdult: true } or null.
    void id;
    return null;
  }

  /**
   * Resolve a playable URL for an episode/stream (mirrors the source resolvers).
   * @returns {Promise<{url:string,type:string}|null>}
   */
  async resolveStream(id, episode) {
    // TODO: Implement with your adult source.
    void id; void episode;
    return null;
  }
}

/**
 * Default no-op adapter. Lets adult mode run end-to-end (toggle, theme, badge,
 * empty catalog) before any real source is connected — nothing is fetched.
 */
class NullAdultSourceAdapter extends AdultSourceAdapter {
  constructor() { super({ name: "none" }); }
  async login() { return false; }
  async search() { return []; }
  async listLatest() { return []; }
  async getDetails() { return null; }
  async resolveStream() { return null; }
}

class UnderHentaiAdultSourceAdapter extends AdultSourceAdapter {
  constructor(config = {}) {
    super({ name: "UnderHentai", baseUrl: "/api/adult/underhentai", ...config });
  }

  async _request(path, params = {}) {
    const endpoint = new URL(`${this.baseUrl}${path}`, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") endpoint.searchParams.set(key, value);
    });
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `${this.name} request failed`);
    }
    return payload;
  }

  _catalogItem(item = {}, sourceIndex = 0) {
    const episodeCount = Math.max(0, Number(item.episodeCount || 0));
    const sourceOrder = Number.isFinite(Number(item.sourceOrder))
      ? Number(item.sourceOrder)
      : sourceIndex;
    return {
      id: `adult-underhentai-${item.slug}`,
      adultId: item.slug,
      slug: item.slug,
      title: item.title || item.slug,
      nativeTitle: item.officialTitle || "",
      thumbnail: item.image || "",
      image: item.image || "",
      banner: item.banner || item.image || "",
      highQualityBackground: item.banner || item.image || "",
      url: item.url || "",
      siteUrl: item.url || "",
      description: item.brand ? `Studio: ${item.brand}` : "Adult title.",
      genres: Array.isArray(item.genres) ? item.genres : [],
      genre: item.genres?.[0] || "Hentai",
      episode: episodeCount,
      totalEpisodes: episodeCount,
      status: item.aired || "",
      source: this.name,
      isAdult: true,
      adult: true,
      adultSource: this.name,
      sourceOrder,
      adultDetailsLoaded: false,
      seasons: [],
      episodes: []
    };
  }

  async search(query, page = 1) {
    const payload = await this._request("/catalog", { q: query, page });
    return (payload.items || []).map((item, index) => this._catalogItem(item, index));
  }

  async listLatest(page = 1) {
    const payload = await this._request("/catalog", { page });
    return (payload.items || []).map((item, index) => this._catalogItem(item, index));
  }

  async getDetails(id) {
    const slug = String(id || "").replace(/^adult-underhentai-/, "");
    const payload = await this._request("/details", { slug });
    const item = payload.item || null;
    if (!item) return null;
    const episodes = (item.episodes || []).map((episode) => ({
      ...episode,
      id: `${slug}-s1-e${episode.episode}`,
      season: 1,
      number: episode.episode,
      server: this.name,
      locked: !(episode.sourceOptions || []).length,
      sourceOptions: (episode.sourceOptions || []).map((source, index) => ({
        ...source,
        id: source.id || `${slug}-e${episode.episode}-source-${index}`,
        type: source.type || "resolver"
      }))
    }));
    return {
      ...this._catalogItem(item),
      description: item.description || (item.brand ? `Studio: ${item.brand}` : "Adult title."),
      officialTitle: item.officialTitle || "",
      brand: item.brand || "",
      episode: episodes.length,
      totalEpisodes: episodes.length,
      episodes,
      seasons: [{
        season: 1,
        title: "Season 1",
        sourceTitle: item.title,
        image: item.image || "",
        playable: true,
        episodes
      }],
      adultDetailsLoaded: true
    };
  }

  async resolveStream(id, episode) {
    const payload = await this._request("/stream", { slug: id, episode });
    return payload;
  }
}

/**
 * Tiny registry so the app can hold a single active adult source and swap it
 * later. Defaults to the null adapter — the app shows the empty 18+ catalog
 * until a real adapter is registered.
 */
const AdultSourceRegistry = (function () {
  "use strict";
  let _active = new NullAdultSourceAdapter();

  return {
    /** Register the active adult source adapter (an AdultSourceAdapter instance). */
    register(adapter) {
      if (adapter instanceof AdultSourceAdapter) _active = adapter;
      return _active;
    },
    /** The currently-active adapter (never null — NullAdultSourceAdapter by default). */
    get() { return _active; },
    /** True once a real (non-null) source has been plugged in. */
    isConfigured() { return !(_active instanceof NullAdultSourceAdapter); }
  };
})();

AdultSourceRegistry.register(new UnderHentaiAdultSourceAdapter());

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AdultSourceAdapter,
    NullAdultSourceAdapter,
    UnderHentaiAdultSourceAdapter,
    AdultSourceRegistry
  };
}
