declare module "iptv-playlist-parser" {
  export interface PlaylistItem {
    name: string;
    url: string;
    tvg: { id: string; name: string; logo: string; url: string };
    group: { title: string } | string;
    raw: string;
  }
  export interface PlaylistHeader {
    attrs: Record<string, string>;
    raw: string;
  }
  export function parse(content: string): {
    header: PlaylistHeader;
    items: PlaylistItem[];
  };
}
