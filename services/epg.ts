import epgParser from 'epg-parser';

export type EpgProgramme = {
  channel: string;
  start: number;
  stop: number;
  title: string;
  desc: string;
};

export type EpgMap = Map<string, EpgProgramme[]>;

const MAX_BYTES = 10 * 1024 * 1024; // skip feeds > 10 MB
const TIMEOUT_MS = 20_000;

function parseEpgDate(s: string): number {
  const d = s.trim();
  const year  = d.slice(0, 4);
  const month = d.slice(4, 6);
  const day   = d.slice(6, 8);
  const hour  = d.slice(8, 10);
  const min   = d.slice(10, 12);
  const sec   = d.slice(12, 14);
  const tz    = (d.slice(14).trim() || '+0000').replace(/(\d{2})(\d{2})$/, '$1:$2');
  return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}${tz}`).getTime();
}

export async function fetchEpg(url: string): Promise<EpgMap> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
      throw new Error('EPG feed too large');
    }

    const xml = await res.text();
    const { programmes } = epgParser.parse(xml);

    const map: EpgMap = new Map();
    for (const p of programmes) {
      const prog: EpgProgramme = {
        channel: p.channel,
        start: parseEpgDate(p.start),
        stop: parseEpgDate(p.stop),
        title: p.title?.[0]?.value ?? '',
        desc: p.desc?.[0]?.value ?? '',
      };
      if (!prog.title) continue;
      const list = map.get(p.channel) ?? [];
      list.push(prog);
      map.set(p.channel, list);
    }
    return map;
  } finally {
    clearTimeout(timer);
  }
}

export function getNow(tvgId: string, epg: EpgMap): EpgProgramme | null {
  if (!tvgId || !epg.size) return null;
  const now = Date.now();
  const progs = epg.get(tvgId) ?? [];
  return progs.find((p) => p.start <= now && now < p.stop) ?? null;
}

export function getNext(tvgId: string, epg: EpgMap): EpgProgramme | null {
  if (!tvgId || !epg.size) return null;
  const now = Date.now();
  const progs = epg.get(tvgId) ?? [];
  return [...progs].sort((a, b) => a.start - b.start).find((p) => p.start > now) ?? null;
}
