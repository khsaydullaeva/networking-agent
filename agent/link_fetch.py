"""Fetches a profile link the user shared (LinkedIn, Instagram, Facebook,
...) and extracts whatever public preview data that platform serves to a
logged-out visitor.

This is NOT a general scraper: LinkedIn and Facebook block most
unauthenticated access to profile content, so in practice this only ever
sees Open Graph / meta-description tags meant for link-preview cards and
search engines (a name, headline, and a short bio, sometimes nothing at
all). That's an intentional, honest limit — see agent/README.md §3.
"""

import re

import httpx

# A generic browser UA — without one, some platforms refuse the request
# outright rather than serving even the public preview markup.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

_META_RE = r'<meta[^>]+(?:property|name)=["\']{prop}["\'][^>]+content=["\']([^"\']+)["\']'
_TITLE_RE = re.compile(r"<title[^>]*>([^<]+)</title>", re.IGNORECASE)


def _meta(html: str, prop: str) -> str | None:
    match = re.search(_META_RE.format(prop=re.escape(prop)), html, re.IGNORECASE)
    return match.group(1) if match else None


async def fetch_link_preview(url: str) -> dict | None:
    """Returns {"url", "title", "snippet"} from the page's public preview
    markup, or None if the fetch failed or the page had nothing usable
    (e.g. it redirected to a login wall)."""
    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True, headers={"User-Agent": _USER_AGENT}
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError:
        return None

    title = _meta(html, "og:title") or _meta(html, "twitter:title")
    description = _meta(html, "og:description") or _meta(html, "twitter:description") or _meta(html, "description")

    if not title:
        title_match = _TITLE_RE.search(html)
        title = title_match.group(1).strip() if title_match else None

    if not title and not description:
        return None

    return {"url": url, "title": title or "", "snippet": description or ""}
