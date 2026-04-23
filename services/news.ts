// GNews API — https://gnews.io  (free: 100 req/day, 10 articles/req)
export const GNEWS_API_KEY = "7b4e26ff1006cdc3db62701d783ff074";

// The Guardian Open Platform — https://open-platform.theguardian.com (free: 5,000 req/day)
export const GUARDIAN_API_KEY = "0405c860-1c4d-4db9-93bb-0aaf5c92bb40";

// RSS feeds via https://rss2json.com (10k req/day, no key)

export interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: Date;
}

export interface NewsCategory {
  key: string;
  label: string;
  iconName: string;
  gnewsKey?: string;
  guardianSection?: string;
  rssFeeds: { url: string; name: string }[];
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  {
    key: "world",
    label: "World",
    iconName: "globe-outline",
    gnewsKey: "general",
    guardianSection: "world",
    rssFeeds: [
      { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC News" },
      { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera" },
    ],
  },
  {
    key: "tech",
    label: "Tech",
    iconName: "hardware-chip-outline",
    gnewsKey: "technology",
    guardianSection: "technology",
    rssFeeds: [
      {
        url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
        name: "BBC Tech",
      },
    ],
  },
  {
    key: "sports",
    label: "Sports",
    iconName: "football-outline",
    gnewsKey: "sports",
    guardianSection: "sport",
    rssFeeds: [
      { url: "https://feeds.bbci.co.uk/news/sport/rss.xml", name: "BBC Sport" },
    ],
  },
  {
    key: "entertainment",
    label: "Entertainment",
    iconName: "film-outline",
    gnewsKey: "entertainment",
    guardianSection: "culture",
    rssFeeds: [
      {
        url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
        name: "BBC Arts",
      },
    ],
  },
  {
    key: "business",
    label: "Business",
    iconName: "briefcase-outline",
    gnewsKey: "business",
    guardianSection: "business",
    rssFeeds: [
      {
        url: "https://feeds.bbci.co.uk/news/business/rss.xml",
        name: "BBC Business",
      },
    ],
  },
  {
    key: "science",
    label: "Science",
    iconName: "flask-outline",
    gnewsKey: "science",
    guardianSection: "science",
    rssFeeds: [
      {
        url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
        name: "BBC Science",
      },
    ],
  },
  {
    key: "health",
    label: "Health",
    iconName: "heart-outline",
    gnewsKey: "health",
    guardianSection: "society",
    rssFeeds: [
      {
        url: "https://feeds.bbci.co.uk/news/health/rss.xml",
        name: "BBC Health",
      },
    ],
  },
];

function upgradeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes("ichef.bbci.co.uk")) {
    // BBC CDN embeds the pixel width right before /cpsprodpb/ or /live/ regardless of
    // the path prefix (/news/, /ace/standard/, /ace/ws/, etc.)
    // e.g. /news/240/cpsprodpb/  →  /news/1024/cpsprodpb/
    //      /ace/standard/480/cpsprodpb/  →  /ace/standard/1024/cpsprodpb/
    return url.replace(/\/\d{2,4}\/(cpsprodpb|live)\//, "/1024/$1/");
  }
  // Guardian: ?width=NNN → ?width=960
  if (url.includes("media.guim.co.uk") || url.includes("i.guim.co.uk"))
    return url.replace(/([?&])width=\d+/, "$1width=960");
  return url;
}

function parseRSSXML(xml: string, sourceName: string): Article[] {
  const items: Article[] = [];
  const blocks = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/g) ?? [];
  for (const block of blocks) {
    const get = (tag: string) =>
      block
        .match(
          new RegExp(
            `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`
          )
        )?.[1]
        ?.trim() ?? "";
    const title = get("title");
    const link =
      get("link") ||
      (block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/)?.[1] ?? "");
    const description = get("description")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .slice(0, 260);
    const pubDate = get("pubDate");
    const imageUrl =
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ??
      block.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ??
      block.match(/url="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1];
    if (title.length > 4 && link) {
      items.push({
        id: link,
        title,
        description,
        url: link,
        imageUrl: upgradeImageUrl(imageUrl || undefined),
        source: sourceName,
        publishedAt: pubDate ? new Date(pubDate) : new Date(),
      });
    }
  }
  return items;
}

async function fetchRSS(
  rssUrl: string,
  sourceName: string
): Promise<Article[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) {
      console.warn(`[news] RSS ${sourceName} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = parseRSSXML(xml, sourceName);
    console.log(`[news] RSS ${sourceName}: ${parsed.length} articles`);
    return parsed;
  } catch (e) {
    console.warn(`[news] RSS ${sourceName} failed:`, e);
    return [];
  }
}

async function fetchGuardian(section: string): Promise<Article[]> {
  if (!GUARDIAN_API_KEY) return [];
  try {
    const url = `https://content.guardianapis.com/search?section=${section}&show-fields=thumbnail,trailText&page-size=10&order-by=newest&api-key=${GUARDIAN_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[news] Guardian ${section} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const results = (data.response?.results ?? []).map(
      (a: any): Article => ({
        id: a.id,
        title: a.webTitle ?? "",
        description: (a.fields?.trailText ?? "").replace(/<[^>]*>/g, "").trim(),
        url: a.webUrl,
        imageUrl: upgradeImageUrl(a.fields?.thumbnail || undefined),
        source: "The Guardian",
        publishedAt: new Date(a.webPublicationDate),
      })
    );
    console.log(`[news] Guardian ${section}: ${results.length} articles`);
    return results;
  } catch (e) {
    console.warn(`[news] Guardian ${section} failed:`, e);
    return [];
  }
}

async function fetchGNews(gnewsKey: string): Promise<Article[]> {
  if (!GNEWS_API_KEY) return [];
  try {
    const url = `https://gnews.io/api/v4/top-headlines?category=${gnewsKey}&lang=en&max=10&token=${GNEWS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[news] GNews ${gnewsKey} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const results = (data.articles ?? []).map(
      (a: any): Article => ({
        id: a.url,
        title: a.title ?? "",
        description: a.description ?? "",
        url: a.url,
        imageUrl: upgradeImageUrl(a.image || undefined),
        source: a.source?.name ?? "GNews",
        publishedAt: new Date(a.publishedAt),
      })
    );
    console.log(`[news] GNews ${gnewsKey}: ${results.length} articles`);
    return results;
  } catch (e) {
    console.warn(`[news] GNews ${gnewsKey} failed:`, e);
    return [];
  }
}

export async function fetchNewsCategory(cat: NewsCategory): Promise<Article[]> {
  const tasks: Promise<Article[]>[] = [];
  if (cat.gnewsKey) tasks.push(fetchGNews(cat.gnewsKey));
  if (cat.guardianSection) tasks.push(fetchGuardian(cat.guardianSection));
  for (const feed of cat.rssFeeds) {
    tasks.push(fetchRSS(feed.url, feed.name));
  }

  const results = await Promise.allSettled(tasks);
  const all = results
    .filter(
      (r): r is PromiseFulfilledResult<Article[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value)
    .filter((a) => a.title.length > 6);

  const seen = new Set<string>();
  const unique = all.filter((a) => {
    const key = a.title.slice(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
  );
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
