declare module "epg-parser" {
  export interface EpgTitle {
    lang: string;
    value: string;
  }
  export interface EpgProgrammeRaw {
    channel: string;
    start: string;
    stop: string;
    title: EpgTitle[];
    desc?: EpgTitle[];
    category?: EpgTitle[];
    icon?: { src: string }[];
  }
  export interface EpgChannelRaw {
    id: string;
    displayName: EpgTitle[];
    icon?: { src: string }[];
  }
  export interface EpgResult {
    channels: EpgChannelRaw[];
    programmes: EpgProgrammeRaw[];
  }
  const parser: { parse: (xml: string) => EpgResult };
  export default parser;
}
