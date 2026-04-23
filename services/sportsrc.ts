// SportSRC V2 API — https://sportsrc.org/v2
// Get a free API key (1,000 req/day) at https://sportsrc.org/v2/#pricing

const BASE = "https://api.sportsrc.org/v2/";

export type SportsTeam = {
  name: string;
  logo: string;
  score: number | null;
  color: string;
};

export type SportsMatch = {
  id: string;
  home: SportsTeam;
  away: SportsTeam;
  status: "inprogress" | "upcoming" | "finished";
  minute: string | null;
  kickoff: string | null;
  competition: string;
  has_stream: boolean;
  date: string;
};

export type MatchDetail = {
  id: string;
  stream_url: string | null;
  home: SportsTeam;
  away: SportsTeam;
  venue: string;
  referee: string;
};
export const SPORTSRC_API_KEY = "fe8f08507fd4118fb92e7b1b75f6cb84";
async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  if (!SPORTSRC_API_KEY) throw new Error("NO_API_KEY");
  const qs = new URLSearchParams({
    ...params,
    date: params.date ?? todayDate(),
  }).toString();
  const res = await fetch(`${BASE}?${qs}`, {
    headers: { "X-API-KEY": SPORTSRC_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  console.log("[sportsrc] params:", JSON.stringify(params));
  console.log("[sportsrc] response:", JSON.stringify(json).slice(0, 600));
  return json as T;
}

function normaliseSportsMatches(json: any): SportsMatch[] {
  // New format: { success, data: [{ league, matches: [...] }] }
  if (json && Array.isArray(json.data)) {
    return json.data.flatMap((group: any) =>
      (group.matches ?? []).map((m: any) =>
        rawToMatch(m, group.league?.name ?? "")
      )
    );
  }
  // Legacy: bare array or { matches: [] }
  const arr = Array.isArray(json) ? json : (json.matches ?? []);
  return arr;
}

function rawToMatch(m: any, competition: string): SportsMatch {
  const home = m.teams?.home ?? {};
  const away = m.teams?.away ?? {};
  const kickoffStr = m.timestamp
    ? new Date(m.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return {
    id: m.id,
    home: {
      name: home.name ?? "",
      logo: home.badge ?? home.logo ?? "",
      score: home.score ?? null,
      color: home.color ?? "#1a3a8f",
    },
    away: {
      name: away.name ?? "",
      logo: away.badge ?? away.logo ?? "",
      score: away.score ?? null,
      color: away.color ?? "#8f1a1a",
    },
    status: m.status,
    minute: m.status_detail ?? null,
    kickoff: kickoffStr,
    competition: m.competition ?? competition,
    has_stream: m.has_stream ?? false,
    date: m.date ?? todayDate(),
  };
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchLiveMatches(): Promise<SportsMatch[]> {
  const json = await apiFetch<any>({
    type: "matches",
    sport: "football",
    status: "inprogress",
  });
  return normaliseSportsMatches(json);
}

export async function fetchUpcomingMatches(): Promise<SportsMatch[]> {
  const json = await apiFetch<any>({
    type: "matches",
    sport: "football",
    status: "upcoming",
  });
  return normaliseSportsMatches(json);
}

export async function fetchMatchDetail(id: string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>({ type: "detail", id });
}
