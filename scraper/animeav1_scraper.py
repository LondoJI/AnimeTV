"""
AnimeAV1 episode source scraper — personal use only.
URL pattern: https://animeav1.com/media/{slug}/{episode}

Video sources are embedded in the SvelteKit hydration payload as:
  embeds:{SUB:[{server:"HLS",url:"..."},{server:"Mega",url:"..."},...]}
  downloads:{SUB:[{server:"Mega",url:"..."},{server:"MP4Upload",url:"..."},...]}
"""

import re
import time
import webbrowser

import requests

BASE_URL = "https://animeav1.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://animeav1.com/",
}

_cache: dict = {}
CACHE_TTL = 300  # seconds


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_html(path: str) -> str:
    """Fetch a page with TTL caching.  `path` is relative to BASE_URL."""
    now = time.time()
    if path in _cache and now - _cache[path]["ts"] < CACHE_TTL:
        return _cache[path]["html"]

    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    _cache[path] = {"ts": now, "html": resp.text}
    return resp.text


def _parse_block(raw: str) -> dict[str, list[dict]]:
    """
    Parse a SvelteKit hydration block like:
        SUB:[{server:"X",url:"Y"},{server:"A",url:"B"}],DUB:[...]
    Returns: {"SUB": [{"provider": "X", "url": "Y"}, ...], "DUB": [...]}
    """
    result: dict[str, list[dict]] = {}
    for m in re.finditer(r'([A-Z]+):\[([^\[\]]*)\]', raw):
        variant = m.group(1)
        pairs = re.findall(r'server:"([^"]+)",url:"([^"]+)"', m.group(2))
        if pairs:
            result[variant] = [{"provider": s, "url": u} for s, u in pairs]
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_episode_sources(slug: str, episode: int) -> dict[str, list[dict]]:
    """
    Return embed sources grouped by variant.

    Returns:
        {"SUB": [{"provider": "HLS", "url": "..."}, ...], "DUB": [...]}
        (DUB key only present when a dub track exists)

    Raises:
        requests.HTTPError  — page not found / server error
        ValueError          — page loaded but embed data not found
    """
    html = _fetch_html(f"/media/{slug}/{episode}")

    m = re.search(r'embeds:\{(.*?)\},downloads:', html, re.DOTALL)
    if not m:
        raise ValueError("Could not find 'embeds' data in page HTML.")

    return _parse_block(m.group(1))


def get_download_links(slug: str, episode: int) -> dict[str, list[dict]]:
    """
    Return download links grouped by variant.

    Returns:
        {"SUB": [{"provider": "Mega", "url": "..."}, ...], "DUB": [...]}
    """
    html = _fetch_html(f"/media/{slug}/{episode}")

    m = re.search(r'downloads:\{(.*?)\}\}', html, re.DOTALL)
    if not m:
        return {}

    return _parse_block(m.group(1))


def get_anime_info(slug: str) -> dict:
    """
    Return basic info about an anime from its main media page.

    Returns:
        {"title": str, "total_episodes": int, "slug": str}
    """
    html = _fetch_html(f"/media/{slug}")

    title_m   = re.search(r'title:"([^"]+)"', html)
    ep_m      = re.search(r'episodesCount:(\d+)', html)
    score_m   = re.search(r'score:([\d.]+)', html)
    status_m  = re.search(r'status:(\d+)', html)

    return {
        "slug":           slug,
        "title":          title_m.group(1)  if title_m  else slug,
        "total_episodes": int(ep_m.group(1)) if ep_m     else 0,
        "score":          float(score_m.group(1)) if score_m else None,
        "status":         int(status_m.group(1))  if status_m else None,
    }


def open_first_source(sources: dict[str, list[dict]], variant: str = "SUB") -> None:
    """Open the first embed source of the given variant in the browser."""
    tracks = sources.get(variant) or next(iter(sources.values()), [])
    if not tracks:
        print("No sources available.")
        return
    first = tracks[0]
    print(f"Opening [{first['provider']}]: {first['url']}")
    webbrowser.open(first["url"])


def clear_cache() -> None:
    _cache.clear()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python animeav1_scraper.py <anime-slug> <episode>")
        print("Example: python animeav1_scraper.py one-piece 1")
        sys.exit(1)

    slug = sys.argv[1]
    try:
        ep = int(sys.argv[2])
    except ValueError:
        print("Episode must be an integer.")
        sys.exit(1)

    print(f"Fetching sources for '{slug}' episode {ep} …")
    time.sleep(1)

    try:
        sources = get_episode_sources(slug, ep)
    except requests.HTTPError as e:
        print(f"HTTP error: {e}")
        sys.exit(1)
    except ValueError as e:
        print(f"Parse error: {e}")
        sys.exit(1)

    for variant, tracks in sources.items():
        print(f"\n[{variant}] {len(tracks)} source(s):")
        for t in tracks:
            print(f"  [{t['provider']}] {t['url']}")

    downloads = get_download_links(slug, ep)
    for variant, links in downloads.items():
        print(f"\n[{variant}] Download links:")
        for d in links:
            print(f"  [{d['provider']}] {d['url']}")

    all_tracks = [t for v in sources.values() for t in v]
    if all_tracks:
        ans = input("\nOpen first source in browser? [y/N] ").strip().lower()
        if ans == "y":
            open_first_source(sources)
