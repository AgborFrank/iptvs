import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system/next";
import { parse } from "iptv-playlist-parser";

export type Channel = {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  sourceId: string;
  tvgId: string;
};

// ── Retry fetch ──────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 30_000;

async function retryFetch(url: string, maxRetries = 3): Promise<string> {
  let delay = 500;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text;
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Max retries exceeded");
}

// ── Favourites persistence ────────────────────────────────────────────────────
const FAV_KEY = "aleigro:favorites";

export async function getFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(channelId: string): Promise<string[]> {
  const favs = await getFavorites();
  const next = favs.includes(channelId)
    ? favs.filter((id) => id !== channelId)
    : [...favs, channelId];
  await AsyncStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

// ── Last-channel persistence ──────────────────────────────────────────────────
const LAST_CH_KEY = "aleigro:lastChannel";

export async function getLastChannel(): Promise<Channel | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveLastChannel(channel: Channel): Promise<void> {
  await AsyncStorage.setItem(LAST_CH_KEY, JSON.stringify(channel));
}

export type PlaylistSource = {
  id: string;
  name: string;
  description: string;
  url: string;
  iconName: string;
  flagCode?: string;
  type: "general" | "category" | "language";
};

export const PLAYLIST_SOURCES: PlaylistSource[] = [
  // ── General ──────────────────────────────────────────────────────
  {
    id: "free-tv",
    name: "Free TV",
    description: "General channels organised by country",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    iconName: "tv-outline",
    type: "general",
  },

  // ── By Category ──────────────────────────────────────────────────
  {
    id: "news",
    name: "News",
    description: "924 live news channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/news.m3u",
    iconName: "newspaper-outline",
    type: "category",
  },
  {
    id: "sports",
    name: "Sports",
    description: "320 live sports channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
    iconName: "football-outline",
    type: "category",
  },
  {
    id: "entertainment",
    name: "Entertainment",
    description: "644 entertainment channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/entertainment.m3u",
    iconName: "film-outline",
    type: "category",
  },
  {
    id: "movies",
    name: "Movies",
    description: "401 movie channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
    iconName: "videocam-outline",
    type: "category",
  },
  {
    id: "series",
    name: "Series",
    description: "192 TV series channels",
    url: "https://iptv-org.github.io/iptv/categories/series.m3u",
    iconName: "albums-outline",
    type: "category",
  },
  {
    id: "music",
    name: "Music",
    description: "638 music channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/music.m3u",
    iconName: "musical-notes-outline",
    type: "category",
  },
  {
    id: "kids",
    name: "Kids",
    description: "226 children's channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/kids.m3u",
    iconName: "happy-outline",
    type: "category",
  },
  {
    id: "animation",
    name: "Animation",
    description: "80 animation channels",
    url: "https://iptv-org.github.io/iptv/categories/animation.m3u",
    iconName: "color-palette-outline",
    type: "category",
  },
  {
    id: "comedy",
    name: "Comedy",
    description: "66 comedy channels",
    url: "https://iptv-org.github.io/iptv/categories/comedy.m3u",
    iconName: "chatbubble-ellipses-outline",
    type: "category",
  },
  {
    id: "documentary",
    name: "Documentary",
    description: "129 documentary channels worldwide",
    url: "https://iptv-org.github.io/iptv/categories/documentary.m3u",
    iconName: "camera-outline",
    type: "category",
  },
  {
    id: "education",
    name: "Education",
    description: "235 education channels",
    url: "https://iptv-org.github.io/iptv/categories/education.m3u",
    iconName: "school-outline",
    type: "category",
  },
  {
    id: "culture",
    name: "Culture",
    description: "166 culture channels",
    url: "https://iptv-org.github.io/iptv/categories/culture.m3u",
    iconName: "earth-outline",
    type: "category",
  },
  {
    id: "science",
    name: "Science",
    description: "20 science & technology channels",
    url: "https://iptv-org.github.io/iptv/categories/science.m3u",
    iconName: "flask-outline",
    type: "category",
  },
  {
    id: "business",
    name: "Business",
    description: "72 business & finance channels",
    url: "https://iptv-org.github.io/iptv/categories/business.m3u",
    iconName: "briefcase-outline",
    type: "category",
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    description: "94 lifestyle channels",
    url: "https://iptv-org.github.io/iptv/categories/lifestyle.m3u",
    iconName: "leaf-outline",
    type: "category",
  },
  {
    id: "food",
    name: "Cooking & Food",
    description: "34 cooking channels",
    url: "https://iptv-org.github.io/iptv/categories/cooking.m3u",
    iconName: "restaurant-outline",
    type: "category",
  },
  {
    id: "travel",
    name: "Travel",
    description: "46 travel & nature channels",
    url: "https://iptv-org.github.io/iptv/categories/travel.m3u",
    iconName: "airplane-outline",
    type: "category",
  },
  {
    id: "outdoor",
    name: "Outdoor",
    description: "54 outdoor & nature channels",
    url: "https://iptv-org.github.io/iptv/categories/outdoor.m3u",
    iconName: "trail-sign-outline",
    type: "category",
  },
  {
    id: "family",
    name: "Family",
    description: "52 family channels",
    url: "https://iptv-org.github.io/iptv/categories/family.m3u",
    iconName: "people-outline",
    type: "category",
  },
  {
    id: "religious",
    name: "Religious",
    description: "708 religious channels",
    url: "https://iptv-org.github.io/iptv/categories/religious.m3u",
    iconName: "book-outline",
    type: "category",
  },
  {
    id: "classic",
    name: "Classic",
    description: "49 classic TV channels",
    url: "https://iptv-org.github.io/iptv/categories/classic.m3u",
    iconName: "time-outline",
    type: "category",
  },
  {
    id: "weather",
    name: "Weather",
    description: "16 weather channels",
    url: "https://iptv-org.github.io/iptv/categories/weather.m3u",
    iconName: "partly-sunny-outline",
    type: "category",
  },

  // ── By Language ──────────────────────────────────────────────────
  {
    id: "lang-eng",
    name: "English",
    description: "Channels broadcast in English",
    url: "https://iptv-org.github.io/iptv/languages/eng.m3u",
    iconName: "globe-outline",
    flagCode: "gb",
    type: "language",
  },
  {
    id: "lang-spa",
    name: "Spanish",
    description: "Channels broadcast in Spanish",
    url: "https://iptv-org.github.io/iptv/languages/spa.m3u",
    iconName: "globe-outline",
    flagCode: "es",
    type: "language",
  },
  {
    id: "lang-fra",
    name: "French",
    description: "Channels broadcast in French",
    url: "https://iptv-org.github.io/iptv/languages/fra.m3u",
    iconName: "globe-outline",
    flagCode: "fr",
    type: "language",
  },
  {
    id: "lang-ara",
    name: "Arabic",
    description: "342 channels broadcast in Arabic",
    url: "https://iptv-org.github.io/iptv/languages/ara.m3u",
    iconName: "globe-outline",
    flagCode: "sa",
    type: "language",
  },
  {
    id: "lang-por",
    name: "Portuguese",
    description: "Channels broadcast in Portuguese",
    url: "https://iptv-org.github.io/iptv/languages/por.m3u",
    iconName: "globe-outline",
    flagCode: "pt",
    type: "language",
  },
  {
    id: "lang-deu",
    name: "German",
    description: "Channels broadcast in German",
    url: "https://iptv-org.github.io/iptv/languages/deu.m3u",
    iconName: "globe-outline",
    flagCode: "de",
    type: "language",
  },
  {
    id: "lang-rus",
    name: "Russian",
    description: "Channels broadcast in Russian",
    url: "https://iptv-org.github.io/iptv/languages/rus.m3u",
    iconName: "globe-outline",
    flagCode: "ru",
    type: "language",
  },
  {
    id: "lang-zho",
    name: "Chinese",
    description: "Channels broadcast in Chinese",
    url: "https://iptv-org.github.io/iptv/languages/zho.m3u",
    iconName: "globe-outline",
    flagCode: "cn",
    type: "language",
  },
  {
    id: "lang-hin",
    name: "Hindi",
    description: "Channels broadcast in Hindi",
    url: "https://iptv-org.github.io/iptv/languages/hin.m3u",
    iconName: "globe-outline",
    flagCode: "in",
    type: "language",
  },
  {
    id: "lang-ita",
    name: "Italian",
    description: "Channels broadcast in Italian",
    url: "https://iptv-org.github.io/iptv/languages/ita.m3u",
    iconName: "globe-outline",
    flagCode: "it",
    type: "language",
  },
  {
    id: "lang-tur",
    name: "Turkish",
    description: "Channels broadcast in Turkish",
    url: "https://iptv-org.github.io/iptv/languages/tur.m3u",
    iconName: "globe-outline",
    flagCode: "tr",
    type: "language",
  },
  {
    id: "lang-ind",
    name: "Indonesian",
    description: "Channels broadcast in Indonesian",
    url: "https://iptv-org.github.io/iptv/languages/ind.m3u",
    iconName: "globe-outline",
    flagCode: "id",
    type: "language",
  },
  {
    id: "lang-nld",
    name: "Dutch",
    description: "Channels broadcast in Dutch",
    url: "https://iptv-org.github.io/iptv/languages/nld.m3u",
    iconName: "globe-outline",
    flagCode: "nl",
    type: "language",
  },
  {
    id: "lang-pol",
    name: "Polish",
    description: "Channels broadcast in Polish",
    url: "https://iptv-org.github.io/iptv/languages/pol.m3u",
    iconName: "globe-outline",
    flagCode: "pl",
    type: "language",
  },
  {
    id: "lang-fas",
    name: "Persian",
    description: "Channels broadcast in Persian (Farsi)",
    url: "https://iptv-org.github.io/iptv/languages/fas.m3u",
    iconName: "globe-outline",
    flagCode: "ir",
    type: "language",
  },
  {
    id: "lang-kor",
    name: "Korean",
    description: "Channels broadcast in Korean",
    url: "https://iptv-org.github.io/iptv/languages/kor.m3u",
    iconName: "globe-outline",
    flagCode: "kr",
    type: "language",
  },
  {
    id: "lang-jpn",
    name: "Japanese",
    description: "Channels broadcast in Japanese",
    url: "https://iptv-org.github.io/iptv/languages/jpn.m3u",
    iconName: "globe-outline",
    flagCode: "jp",
    type: "language",
  },
];

export const DEFAULT_SOURCE_IDS = ["free-tv"];

const sourceCache = new Map<string, Channel[]>();
const epgUrlCache = new Map<string, string>(); // sourceId → EPG feed URL

export function getEpgUrl(sourceId: string): string | undefined {
  return epgUrlCache.get(sourceId);
}

export async function fetchFromSources(ids: string[]): Promise<Channel[]> {
  const sources = PLAYLIST_SOURCES.filter((s) => ids.includes(s.id));
  if (sources.length === 0)
    throw new Error(`No playlist source found for: ${ids.join(", ")}`);

  const results = await Promise.allSettled(sources.map(fetchSource));

  const merged: Channel[] = [];
  const seen = new Set<string>();
  let failures = 0;

  for (const r of results) {
    if (r.status !== "fulfilled") {
      failures++;
      console.warn(
        "[iptv] source failed:",
        (r as PromiseRejectedResult).reason
      );
      continue;
    }
    for (const ch of r.value) {
      if (!seen.has(ch.url)) {
        seen.add(ch.url);
        merged.push(ch);
      }
    }
  }

  if (failures === results.length) {
    throw new Error(
      "Failed to load channels. Check your connection and try again."
    );
  }

  return merged;
}

async function fetchSource(source: PlaylistSource): Promise<Channel[]> {
  if (sourceCache.has(source.id)) return sourceCache.get(source.id)!;
  const text = await retryFetch(source.url);
  const channels = parseM3U(text, source.id);
  sourceCache.set(source.id, channels);
  return channels;
}

export function clearSourceCache(id?: string) {
  if (id) sourceCache.delete(id);
  else sourceCache.clear();
}

export async function fetchFromUrl(url: string): Promise<Channel[]> {
  const text = await retryFetch(url);
  return parseM3U(text, "custom");
}

export async function loadFromFile(fileUri: string): Promise<Channel[]> {
  const file = new File(fileUri);
  const text = await file.text();
  return parseM3U(text, "custom");
}

export function getGroups(channels: Channel[]): string[] {
  const set = new Set(channels.map((c) => c.group));
  return ["All", ...Array.from(set).sort()];
}

function parseM3U(content: string, sourceId: string): Channel[] {
  const result = parse(content);

  // Capture EPG URL from playlist header (url-tvg or x-tvg-url)
  const epgUrl: string =
    result.header?.attrs?.["url-tvg"] ??
    result.header?.attrs?.["x-tvg-url"] ??
    "";
  if (epgUrl) epgUrlCache.set(sourceId, epgUrl);

  return (result.items as any[])
    .map((item: any, idx: number) => {
      let group: string = item.group?.title ?? item.group ?? "Other";
      if (typeof group === "object" && (group as any).title)
        group = (group as any).title;
      if (typeof group !== "string" || !group.trim()) group = "Other";
      if (group.includes(";")) group = group.split(";")[0];
      return {
        id: `${sourceId}-${idx}`,
        name: (item.name ?? "").trim(),
        logo: item.tvg?.logo ?? "",
        group,
        url: item.url ?? "",
        sourceId,
        tvgId: item.tvg?.id ?? "",
      } as Channel;
    })
    .filter((ch) => ch.name && ch.url);
}
