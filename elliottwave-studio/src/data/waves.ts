// The nu.waves catalogue: what plays on waves.khensu.nu and in the nu.waves app. One module feeds the
// server-rendered page, the client bundle and /waves/catalogue.json (the app's feed). Every entry names its
// licence; anything from outside (Musopen, mobygratis) is here under its own free licence and credited the way
// that licence asks. Healing sounds are generated on the device from a short recipe,
// so they cost no bytes and loop forever. Live channels are programmes pinned to the clock: everyone who tunes in
// hears the same moment, from any device, with no server deciding what plays.

import MOBYGRATIS from './mobygratis.json';

export type Pos = { x: number; y: number; z: number };

export type ArtistKind = 'artist' | 'band' | 'composer' | 'creator';
export type Artist = {
  id: string;
  name: string;
  kind: ArtistKind;
  /** Permanent handle on the network, resolved from the key transparency log. */
  handle?: string;
  bio: string;
  art: string;
  /** CSS art class when there is no image. */
  artClass?: string;
  links?: { label: string; href: string }[];
};

export type Source = { url: string; type: string };
export type Stem = { id: string; label: string; url: string; kbps: number; mark: string };

export type Generator =
  | { type: 'tone'; hz: number; hold: number; fade: number; mark: string }
  | { type: 'bowl'; hz: number; mark: string }
  | { type: 'binaural'; carrier: number; beat: number; mark: string }
  | { type: 'noise'; colour: 'brown' | 'pink' | 'white'; mark: string }
  | { type: 'rain'; mark: string }
  | { type: 'ocean'; mark: string }
  | { type: 'forest'; mark: string }
  | { type: 'creek'; mark: string }
  | { type: 'clip'; url: string; mark: string };

export type Spatial = 'stems' | 'stereo' | 'mono' | 'direct';

export type LyricRole = 'lead' | 'chorus' | 'backing' | 'spoken';

export type LyricWord = {
  /** Word text */
  w: string;
  /** Exact word start timecode in seconds (Apple Speech framework / score alignment) */
  t: number;
  /** Word duration in seconds */
  d: number;
  /** Optional per-word role override (e.g. backing harmony echo inside a lead line) */
  role?: LyricRole;
};

export type LyricLine = {
  /** Line start time in seconds */
  t: number;
  /** Line end time in seconds */
  end: number;
  /** Vocal / audio layer role: lead, chorus, backing/background, or spoken */
  role: LyricRole;
  /** Optional label shown beside the line (e.g. "chorus", "backing", "winds & strings") */
  tag?: string;
  /** Exact word-by-word timecodes for Spotify + IG Story pop animation */
  words: LyricWord[];
};

/** Builds a word-timed LyricLine from a start/end window and phrase (with optional inline `(backing: ...)` words). */
export const lyricLine = (t: number, end: number, phrase: string, role: LyricRole = 'lead', tag?: string): LyricLine => {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  const span = Math.max(0.4, end - t);
  const step = span / Math.max(1, tokens.length);
  let inBacking = false;
  const words: LyricWord[] = tokens.map((raw, i) => {
    let w = raw;
    let wRole: LyricRole | undefined;
    if (w.startsWith('(')) inBacking = true;
    if (inBacking) wRole = 'backing';
    if (w.endsWith(')')) inBacking = false;
    return {
      w,
      t: +(t + i * step).toFixed(2),
      d: +Math.max(0.16, step * 0.92).toFixed(2),
      ...(wRole && wRole !== role ? { role: wRole } : {}),
    };
  });
  return { t, end, role, ...(tag ? { tag } : {}), words };
};

export type Track = {
  id: string;
  title: string;
  artistId: string;
  albumId?: string;
  /** Seconds. Generators loop; their dur is the loop or the hold plus fade. */
  dur: number;
  /** Bytes of the main source, measured on the file this page plays. */
  bytes?: number;
  year?: number;
  kind: 'song' | 'generator';
  spatial: Spatial;
  /** The file to play. Several entries are alternatives in order of preference. */
  src?: Source[];
  /** Separated instruments, each its own object in the spacetime bubble. */
  stems?: Stem[];
  /** The untouched original, when the main presentation is a split. */
  original?: Source[];
  /** A fixed-speaker comparison mix. */
  bed?: { label: string; src: Source[]; spec: string };
  gen?: Generator;
  /** Multiple generated sounds placed in the spacetime bubble at once (e.g. all 7 chakras or all healing tones). */
  gens?: { id: string; label: string; gen: Generator; pos: Pos }[];
  /** Word-by-word synchronized lyrics / score cues with lead, chorus, backing and spoken labels. */
  lyrics?: LyricLine[];
  /** Where a single sound sits by default (generators and mono tracks). */
  pos?: Pos;
  spec?: string;
  licence: string;
  loop?: boolean;
  tags: string[];
  /** Listed before its audio is hosted; it can't play or lend stems yet. */
  pending?: boolean;
  /** Free under a non-commercial licence: never sold, never paid per play, never behind a paywall. */
  nonCommercial?: boolean;
  bpm?: number;
};

export type Album = {
  id: string;
  title: string;
  artistId: string;
  kind: 'album' | 'single' | 'ep' | 'live' | 'collection';
  year: number;
  art: string;
  artClass?: string;
  tracks: string[];
  licence: string;
  note?: string;
  price?: string;
};

export type Collection = {
  id: string;
  title: string;
  desc: string;
  art: string;
  artClass?: string;
  tracks: string[];
  /** Plays as one continuous journey: tracks crossfade and the whole list loops. */
  journey?: boolean;
};

export type ProgrammeItem = { trackId: string; dur: number };
export type Channel = {
  id: string;
  name: string;
  by: string;
  artistId?: string;
  desc: string;
  art: string;
  artClass?: string;
  kind: 'live' | 'creator';
  /** Live channels: the programme repeats from this epoch (ms since 1970), so every listener hears the same moment. */
  epoch?: number;
  programme?: ProgrammeItem[];
  /** Creator channels publish releases and go live when they play. */
  releases?: string[];
  live: boolean;
};

export type Venue = {
  id: string;
  label: string;
  why: string;
  rt: number;
  wet: number;
  pre: number;
  stems: Record<string, Pos>;
  /** Left and right objects of a stereo track. */
  stereo: { l: Pos; r: Pos };
  mono: Pos;
};

const S = '/khensu/sounds';
const W = '/khensu/waves';
/** Large catalogues live in their own bucket so a site publish never deletes them. */
const MEDIA = 'https://storage.googleapis.com/khensu-waves-media';
const CC0 = 'CC0 1.0 (public domain dedication)';

export const STEM_MARK: Record<string, string> = {
  drums: '#e8e4dc',
  piano: '#f4f1ea',
  synths: '#7ec8ff',
  guitar: '#c8a2ff',
  bass: '#6dffbf',
};

export const VENUES: Venue[] = [
  {
    id: 'room',
    label: 'Private room',
    why: 'Private room. Close and dry, an arm’s length away.',
    rt: 0.45,
    wet: 0.12,
    pre: 0.004,
    stems: { drums: { x: 0, y: 1.3, z: 0 }, piano: { x: -1, y: 0.9, z: 0 }, synths: { x: 1.1, y: 0.5, z: 0.4 }, guitar: { x: 0.8, y: 1.1, z: 0.2 }, bass: { x: -0.3, y: 0.7, z: -0.4 } },
    stereo: { l: { x: -0.9, y: 1.2, z: 0 }, r: { x: 0.9, y: 1.2, z: 0 } },
    mono: { x: 0, y: 1.2, z: 0 },
  },
  {
    id: 'club',
    label: 'Club',
    why: 'Club. Drums a few steps away, keys either side.',
    rt: 0.9,
    wet: 0.2,
    pre: 0.012,
    stems: { drums: { x: 0, y: 2.6, z: 0.7 }, piano: { x: -1.9, y: 1.4, z: 0 }, synths: { x: 1.1, y: 0.5, z: 1.7 }, guitar: { x: 2.3, y: 1.6, z: -0.3 }, bass: { x: -0.9, y: 1, z: -0.8 } },
    stereo: { l: { x: -1.6, y: 2.2, z: 0.2 }, r: { x: 1.6, y: 2.2, z: 0.2 } },
    mono: { x: 0, y: 2.4, z: 0.3 },
  },
  {
    id: 'hall',
    label: 'Concert hall',
    why: 'Concert hall. Strings, winds and piano, written as a film score.',
    rt: 2.1,
    wet: 0.32,
    pre: 0.025,
    stems: { drums: { x: 0, y: 3.4, z: 0.9 }, piano: { x: -2.3, y: 2.6, z: 0.3 }, synths: { x: 1.4, y: 2.2, z: 1.8 }, guitar: { x: 2.6, y: 3, z: -0.1 }, bass: { x: -1.1, y: 3.2, z: -0.7 } },
    stereo: { l: { x: -2, y: 3.2, z: 0.4 }, r: { x: 2, y: 3.2, z: 0.4 } },
    mono: { x: 0, y: 3.4, z: 0.5 },
  },
  {
    id: 'stadium',
    label: 'Stadium',
    why: 'Stadium. The band far ahead, the room all the way round.',
    rt: 3.2,
    wet: 0.38,
    pre: 0.06,
    stems: { drums: { x: 0, y: 3.4, z: 1.6 }, piano: { x: -3, y: 2, z: 0.8 }, synths: { x: 2.6, y: -1.6, z: 2 }, guitar: { x: 2.4, y: 2.2, z: 1 }, bass: { x: 0, y: 2.8, z: 0.4 } },
    stereo: { l: { x: -2.6, y: 3, z: 1.2 }, r: { x: 2.6, y: 3, z: 1.2 } },
    mono: { x: 0, y: 3.6, z: 1.4 },
  },
  {
    id: 'festival',
    label: 'Festival',
    why: 'Festival. Kick and bass centred, the rest wrapping around.',
    rt: 1.4,
    wet: 0.24,
    pre: 0.03,
    stems: { drums: { x: 0, y: 2.6, z: 0.4 }, piano: { x: -2.4, y: -1.4, z: 1 }, synths: { x: 2.2, y: -1.4, z: 2 }, guitar: { x: 2.2, y: 1.8, z: 0.6 }, bass: { x: 0, y: 1, z: -0.5 } },
    stereo: { l: { x: -2.4, y: 1.6, z: 0.6 }, r: { x: 2.4, y: 1.6, z: 0.6 } },
    mono: { x: 0, y: 2.2, z: 0.5 },
  },
];

export const ARTISTS: Artist[] = [
  {
    id: 'khensu',
    name: 'khėnsu.ñü',
    kind: 'artist',
    handle: 'khensu.khensu.nu',
    bio: 'The first artist on nu.waves. First Attempt was written in GarageBand in 2008 as a film score; all that survived is a small stereo file, now split into its instruments and placed in a concert hall.',
    art: `${S}/first-attempt.webp`,
    links: [{ label: 'Instagram', href: 'https://www.instagram.com/khensu.nu/' }],
  },
  {
    id: 'chopin',
    name: 'Frédéric Chopin',
    kind: 'composer',
    bio: 'Polish composer and pianist, 1810–1849. These recordings were commissioned by Musopen and released to the public domain, so they can be played, shared and kept by anyone.',
    art: `${W}/chopin/cover.webp`,
    links: [{ label: 'Musopen on the Internet Archive', href: 'https://archive.org/details/musopen-chopin' }],
  },
  {
    id: 'waves',
    name: 'ñü.ŵævẽš healing',
    kind: 'creator',
    handle: 'waves.khensu.nu',
    bio: 'Sleep, focus and healing sounds, generated on your own device from a short recipe. No file to download, no server, and every loop is seamless.',
    art: '',
    artClass: 'h1',
  },
  {
    id: 'mobygratis',
    name: 'mobygratis',
    kind: 'artist',
    bio: 'Free instrumental music for creators, every track with its full multitrack stems. Play any of it in the spacetime bubble, or pull its drums, bass or keys into your own song. Free and non-commercial: never sold, never paid per play, and not for promoting right-wing politics, meat, dairy or other animal products.',
    art: '',
    artClass: 'h4',
    links: [
      { label: 'mobygratis.com', href: 'https://mobygratis.com/' },
      { label: 'Licence', href: 'https://mobygratis.com/license-agreement' },
    ],
  },
];

export const MOBYGRATIS_LICENCE = 'mobygratis licence · free, non-commercial · credit “Music by mobygratis”';

type MobyEntry = {
  id: string;
  uuid: string;
  title: string;
  tags: string[];
  bpm: number | null;
  dur: number;
  restricted?: boolean;
  stems?: { id: string; label: string; file: string; kbps: number }[];
};

const MOBY_MARKS = ['#e8e4dc', '#7ec8ff', '#6dffbf', '#c8a2ff', '#ffd23c', '#ff8a3c', '#f4f1ea', '#38a8ff', '#ff4b4b', '#b07cff'];

const mobyTrack = (m: MobyEntry): Track => {
  const stems = (m.stems ?? []).map((s, i) => ({
    id: s.id,
    label: s.label,
    url: `${MEDIA}/mobygratis/${m.id}/${s.file}`,
    kbps: s.kbps,
    mark: STEM_MARK[s.id] ?? MOBY_MARKS[i % MOBY_MARKS.length],
  }));
  return {
    id: `mg-${m.id}`,
    title: m.title,
    artistId: 'mobygratis',
    albumId: 'mobygratis-catalogue',
    dur: m.dur,
    kind: 'song',
    spatial: 'stems',
    stems: stems.length ? stems : undefined,
    spec: stems.length ? `${stems.length} stems in 3D${m.bpm ? ` · ${m.bpm} BPM` : ''}` : `multitrack · stems arriving${m.bpm ? ` · ${m.bpm} BPM` : ''}`,
    licence: m.restricted ? `${MOBYGRATIS_LICENCE} · Restricted Track: play only, no remix` : MOBYGRATIS_LICENCE,
    tags: ['mobygratis', 'instrumental', ...m.tags],
    pending: !stems.length,
    nonCommercial: true,
    bpm: m.bpm ?? undefined,
  };
};

export const MOBYGRATIS_TRACKS: Track[] = (MOBYGRATIS.tracks as MobyEntry[]).map(mobyTrack);

/** Whether a track's stems can be pulled into another song. Restricted Tracks play but are never remixed. */
export const lendsStems = (t: Pick<Track, 'stems' | 'pending' | 'licence'>) => !!t.stems?.length && !t.pending && !t.licence.includes('Restricted Track');

const chopinTrack = (id: string, title: string, file: string, dur: number, bytes: number, tags: string[]): Track => ({
  id,
  title,
  artistId: 'chopin',
  albumId: 'chopin-nocturnes',
  dur,
  bytes,
  year: 2012,
  kind: 'song',
  spatial: 'stereo',
  src: [{ url: `${W}/chopin/${file}.mp3`, type: 'audio/mpeg' }],
  spec: 'MP3 · stereo · 44.1 kHz',
  licence: CC0,
  tags,
});

const CHAKRAS: { id: string; name: string; en: string; hz: number; hex: string; pos: Pos }[] = [
  { id: 'root', name: 'Muladhara', en: 'Root', hz: 194.18, hex: '#ff4b4b', pos: { x: 0, y: 0.4, z: -1.2 } },
  { id: 'sacral', name: 'Svadhisthana', en: 'Sacral', hz: 210.42, hex: '#ff8a3c', pos: { x: 0.15, y: 0.4, z: -0.75 } },
  { id: 'solar', name: 'Manipura', en: 'Solar plexus', hz: 126.22, hex: '#ffd23c', pos: { x: -0.1, y: 0.45, z: -0.4 } },
  { id: 'heart', name: 'Anahata', en: 'Heart', hz: 136.1, hex: '#3ccf7a', pos: { x: 0, y: 0.5, z: -0.12 } },
  { id: 'throat', name: 'Vishuddha', en: 'Throat', hz: 141.27, hex: '#38a8ff', pos: { x: 0, y: 0.42, z: 0.08 } },
  { id: 'eye', name: 'Ajna', en: 'Third eye', hz: 221.23, hex: '#6c6cff', pos: { x: 0, y: 0.45, z: 0.22 } },
  { id: 'crown', name: 'Sahasrara', en: 'Crown', hz: 172.06, hex: '#b07cff', pos: { x: 0, y: 0.2, z: 0.55 } },
];
export const CHAKRA_IDS = CHAKRAS.map((c) => `chakra-${c.id}`);

const chakraTrack = (c: (typeof CHAKRAS)[number]): Track => ({
  id: `chakra-${c.id}`,
  title: c.name,
  artistId: 'waves',
  albumId: 'healing-chakras',
  dur: 12,
  kind: 'generator',
  spatial: 'mono',
  gen: { type: 'tone', hz: c.hz, hold: 8, fade: 4, mark: c.hex },
  pos: c.pos,
  spec: `${c.hz.toFixed(2)} Hz · ${c.en} · generated on your device`,
  licence: 'khėnsu.ñü · generated',
  tags: ['healing', 'chakra', c.en.toLowerCase()],
});

const healing = (id: string, title: string, gen: Generator, dur: number, spec: string, pos: Pos, tags: string[], spatial: Spatial = 'mono'): Track => ({
  id,
  title,
  artistId: 'waves',
  albumId: 'healing-nature',
  dur,
  kind: 'generator',
  spatial,
  gen,
  pos,
  spec,
  licence: 'khėnsu.ñü · generated',
  loop: true,
  tags,
});

export const TRACKS: Track[] = [
  {
    id: 'first-attempt',
    title: 'First Attempt (Demo)',
    artistId: 'khensu',
    albumId: 'more-of-the-same',
    dur: 400.06,
    bytes: 9_100_000,
    year: 2008,
    kind: 'song',
    spatial: 'stems',
    stems: [
      { id: 'drums', label: 'Drums', url: `${S}/stems/drums.mp4`, kbps: 45, mark: STEM_MARK.drums },
      { id: 'piano', label: 'Piano', url: `${S}/stems/piano.mp4`, kbps: 39, mark: STEM_MARK.piano },
      { id: 'synths', label: 'Winds & strings', url: `${S}/stems/synths.mp4`, kbps: 48, mark: STEM_MARK.synths },
      { id: 'guitar', label: 'Strings', url: `${S}/stems/guitar.mp4`, kbps: 21, mark: STEM_MARK.guitar },
      { id: 'bass', label: 'Bass', url: `${S}/stems/bass.mp4`, kbps: 20, mark: STEM_MARK.bass },
    ],
    original: [{ url: `${S}/first-attempt-original.m4a`, type: 'audio/mp4; codecs="mp4a.40.2"' }],
    bed: {
      label: 'opus 5.1',
      spec: 'Opus · 5.1 · 48 kHz · 17.6 MB · 6:40',
      src: [
        { url: `${S}/first-attempt-51.mp4`, type: 'audio/mp4; codecs="opus"' },
        { url: `${S}/first-attempt-51.m4a`, type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    },
    spec: '5 instruments in 3D · 48 kHz · 9.1 MB · 6:40',
    licence: '© 2008 khėnsu.ñü. All rights reserved; streamed here with the artist’s permission.',
    tags: ['film score', 'orchestral', 'piano', 'strings', 'demo'],
    lyrics: [
      lyricLine(0, 6.2, 'First Attempt · Venice film score in 3D space', 'spoken', 'intro'),
      lyricLine(6.2, 13.8, 'Piano opens on the left · strings breathe ahead', 'lead', 'piano & strings'),
      lyricLine(13.8, 22.0, '(winds rising above the room · gentle pulse)', 'backing', 'backing winds'),
      lyricLine(22.0, 31.5, 'Step inside the spacetime bubble · move every sound', 'chorus', 'chorus theme'),
      lyricLine(31.5, 41.0, 'Drums lock the horizon (strings answer from behind)', 'lead', 'lead motif'),
      lyricLine(41.0, 52.0, 'Every instrument lives in its own coordinate in the hall', 'chorus', 'chorus swell'),
      lyricLine(52.0, 64.0, '(low bass resonance · warm woodwinds echoing)', 'backing', 'backing harmony'),
      lyricLine(64.0, 78.0, 'Turn your head and the concert hall turns with you', 'lead', 'spatial bridge'),
      lyricLine(78.0, 94.0, 'Five stems in open space · nothing folded flat', 'chorus', 'chorus theme'),
      lyricLine(94.0, 112.0, '(piano arpeggio drifting across the dome)', 'backing', 'backing piano'),
      lyricLine(112.0, 132.0, 'Written in 2008 · reborn in post-quantum 3D audio', 'lead', 'movement II'),
      lyricLine(132.0, 154.0, 'Strings and winds climb together into the canopy', 'chorus', 'full chorus'),
      lyricLine(154.0, 180.0, '(counter-melody in the violas · soft reverb tail)', 'backing', 'backing strings'),
      lyricLine(180.0, 210.0, 'Drag any sound closer · let the room breathe around you', 'lead', 'movement III'),
      lyricLine(210.0, 245.0, 'Full orchestral swell · khėnsu.ñü in the concert hall', 'chorus', 'chorus climax'),
      lyricLine(245.0, 290.0, '(high strings shimmering · bass holding the floor)', 'backing', 'backing ensemble'),
      lyricLine(290.0, 345.0, 'Returning to the piano theme · quiet light on water', 'lead', 'coda'),
      lyricLine(345.0, 400.0, '(final chord fading into the hall · ñü.ŵævẽš)', 'backing', 'outro'),
    ],
  },
  {
    ...chopinTrack('chopin-nocturne-op9-no2', 'Nocturne Op. 9 No. 2 in E flat major', 'nocturne-op9-no2', 276.65, 5_354_496, ['piano', 'nocturne', 'night', 'classical']),
    lyrics: [
      lyricLine(0, 10.5, 'Andante · E-flat major cantabile opening phrase', 'lead', 'lead melody'),
      lyricLine(10.5, 22.0, '(left-hand waltz bass · gentle rubato accompaniment)', 'backing', 'backing left hand'),
      lyricLine(22.0, 36.0, 'Ornamented turn · the singing line rises and sighs', 'chorus', 'main theme'),
      lyricLine(36.0, 54.0, 'Second statement with delicate filigree grace notes', 'lead', 'variation'),
      lyricLine(54.0, 76.0, '(harmonic shift into the nocturnal middle section)', 'backing', 'backing harmony'),
      lyricLine(76.0, 105.0, 'Soaring octave melody · rubato across the stereo stage', 'chorus', 'chorus theme'),
    ],
  },
  chopinTrack('chopin-waltz-op64-no2', 'Waltz Op. 64 No. 2 in C sharp minor', 'waltz-op64-no2', 230.09, 5_126_656, ['piano', 'waltz', 'classical']),
  chopinTrack('chopin-prelude-op28-no15', 'Prelude Op. 28 No. 15 “Raindrop”', 'prelude-op28-no15', 295.27, 5_668_200, ['piano', 'prelude', 'rain', 'classical']),
  chopinTrack('chopin-fantaisie-impromptu', 'Fantaisie-Impromptu Op. 66', 'fantaisie-impromptu-op66', 326.93, 6_707_200, ['piano', 'classical']),
  chopinTrack('chopin-nocturne-op27-no2', 'Nocturne Op. 27 No. 2 in D flat major', 'nocturne-op27-no2', 377.81, 7_491_584, ['piano', 'nocturne', 'night', 'classical']),
  chopinTrack('chopin-waltz-op64-no1', 'Waltz Op. 64 No. 1 “Minute”', 'waltz-op64-no1', 107.47, 2_489_344, ['piano', 'waltz', 'classical']),
  chopinTrack('chopin-mazurka-op17-no4', 'Mazurka Op. 17 No. 4 in A minor', 'mazurka-op17-no4', 299.52, 5_526_528, ['piano', 'mazurka', 'classical']),
  chopinTrack('chopin-prelude-op28-no7', 'Prelude Op. 28 No. 7 in A major', 'prelude-op28-no7', 155.3, 3_254_544, ['piano', 'prelude', 'classical']),
  chopinTrack('chopin-nocturne-op48-no1', 'Nocturne Op. 48 No. 1 in C minor', 'nocturne-op48-no1', 379.3, 6_243_328, ['piano', 'nocturne', 'night', 'classical']),
  chopinTrack('chopin-waltz-op69-no1', 'Waltz Op. 69 No. 1 “L’Adieu”', 'waltz-op69-no1', 248.42, 5_426_176, ['piano', 'waltz', 'classical']),
  chopinTrack('chopin-prelude-op28-no1', 'Prelude Op. 28 No. 1 in C major', 'prelude-op28-no1', 39.86, 800_976, ['piano', 'prelude', 'classical']),
  ...CHAKRAS.map(chakraTrack),
  {
    id: 'all-chakras-3d',
    title: 'All 7 chakra tones (3D)',
    artistId: 'waves',
    albumId: 'healing-chakras',
    dur: 60,
    kind: 'generator',
    spatial: 'stems',
    gen: { type: 'tone', hz: 136.1, hold: 10, fade: 4, mark: '#3ccf7a' },
    gens: CHAKRAS.map((c) => ({
      id: c.id,
      label: `${c.en} · ${Math.round(c.hz)} Hz`,
      gen: { type: 'tone', hz: c.hz, hold: 10, fade: 4, mark: c.hex },
      pos: c.pos,
    })),
    spec: '7 chakra tones in 3D · root to crown · generated on your device',
    licence: 'khėnsu.ñü · generated',
    loop: true,
    tags: ['healing', 'chakra', 'meditation', '3d'],
    lyrics: [
      lyricLine(0, 8.5, 'Muladhara · 194.18 Hz root grounding below you', 'lead', 'root chakra'),
      lyricLine(8.5, 17.0, 'Svadhisthana · 210.42 Hz sacral warmth rising (126.22 Hz solar)', 'backing', 'sacral & solar'),
      lyricLine(17.0, 26.0, 'Anahata · 136.10 Hz heart centre opening in 3D space', 'chorus', 'heart chorus'),
      lyricLine(26.0, 36.0, 'Vishuddha · 141.27 Hz throat resonance · clear breath', 'lead', 'throat chakra'),
      lyricLine(36.0, 48.0, 'Ajna · 221.23 Hz third eye (Sahasrara 172.06 Hz crown above)', 'chorus', 'crown harmonic'),
      lyricLine(48.0, 60.0, '(all seven planetary frequencies aligned in the bubble)', 'backing', 'full 3D field'),
    ],
  },
  {
    id: 'all-healing-tones',
    title: 'All healing tones (3D)',
    artistId: 'waves',
    albumId: 'healing-chakras',
    dur: 90,
    kind: 'generator',
    spatial: 'stems',
    gen: { type: 'bowl', hz: 528, mark: '#18e0c8' },
    gens: [
      { id: 'bowl-528', label: '528 Hz Bowl', gen: { type: 'bowl', hz: 528, mark: '#18e0c8' }, pos: { x: 0.9, y: 1.5, z: 0.35 } },
      { id: 'bowl-432', label: '432 Hz Bowl', gen: { type: 'bowl', hz: 432, mark: '#c9a96e' }, pos: { x: -0.9, y: 1.5, z: 0.35 } },
      { id: 'bowl-396', label: '396 Hz Bowl', gen: { type: 'bowl', hz: 396, mark: '#ff8a3c' }, pos: { x: 0, y: 1.9, z: -0.2 } },
      ...CHAKRAS.map((c, idx) => {
        const ang = ((idx - 3) / 3.5) * 1.35;
        return {
          id: c.id,
          label: `${c.en} (${Math.round(c.hz)} Hz)`,
          gen: { type: 'tone' as const, hz: c.hz, hold: 10, fade: 4, mark: c.hex },
          pos: { x: Math.sin(ang) * 1.4, y: Math.cos(ang) * 1.4, z: c.pos.z },
        };
      }),
    ],
    spec: '10 healing tones & singing bowls in 3D · generated on your device',
    licence: 'khėnsu.ñü · generated',
    loop: true,
    tags: ['healing', 'chakra', 'solfeggio', 'meditation', '3d'],
    lyrics: [
      lyricLine(0, 12.0, '528 Hz & 432 Hz Solfeggio singing bowls strike ahead', 'chorus', 'solfeggio bowls'),
      lyricLine(12.0, 26.0, '(396 Hz bowl & root-to-crown chakra ring humming)', 'backing', 'backing harmonics'),
      lyricLine(26.0, 44.0, 'Breathe in · ten pure frequencies orbiting the bubble', 'lead', 'guided breath'),
      lyricLine(44.0, 66.0, 'Heart 136.1 Hz & 528 Hz shimmer in harmonic lock', 'chorus', 'chorus resonance'),
      lyricLine(66.0, 90.0, '(seamless on-device synthesis · zero bytes streamed)', 'backing', 'sustained field'),
    ],
  },
  healing('creek', 'Stair Creek', { type: 'creek', mark: '#3d8f8a' }, 48, 'One sound beside you · generated · loops', { x: -1.5, y: -1.6, z: -0.6 }, ['healing', 'nature', 'water', 'sleep']),
  healing('rain', 'Rain on glass', { type: 'rain', mark: '#7fb3d5' }, 60, 'Rain on a window · generated · loops', { x: 0.6, y: 1.4, z: 1.2 }, ['healing', 'nature', 'rain', 'sleep']),
  healing('ocean', 'Ocean at night', { type: 'ocean', mark: '#3a7bd5' }, 60, 'Waves on a beach · generated · loops', { x: 0, y: 2.6, z: -0.3 }, ['healing', 'nature', 'ocean', 'sleep']),
  healing('forest', 'Forest wind', { type: 'forest', mark: '#4caf7d' }, 60, 'Wind in leaves, a few birds · generated · loops', { x: 1.8, y: 1.2, z: 1.6 }, ['healing', 'nature', 'forest', 'focus']),
  healing('brown-noise', 'Brown noise', { type: 'noise', colour: 'brown', mark: '#a9876a' }, 60, 'Deep noise · generated · loops', { x: 0, y: 0.8, z: 0 }, ['healing', 'noise', 'focus', 'sleep']),
  healing('pink-noise', 'Pink noise', { type: 'noise', colour: 'pink', mark: '#e39bb5' }, 60, 'Soft noise · generated · loops', { x: 0, y: 0.8, z: 0 }, ['healing', 'noise', 'focus']),
  healing('theta-6', 'Theta 6 Hz', { type: 'binaural', carrier: 200, beat: 6, mark: '#8b7bff' }, 60, 'Binaural beat · 200 Hz carrier · one tone per ear', { x: 0, y: 0, z: 0 }, ['healing', 'binaural', 'meditation'], 'direct'),
  healing('alpha-10', 'Alpha 10 Hz', { type: 'binaural', carrier: 220, beat: 10, mark: '#6fc3ff' }, 60, 'Binaural beat · 220 Hz carrier · one tone per ear', { x: 0, y: 0, z: 0 }, ['healing', 'binaural', 'focus'], 'direct'),
  healing('delta-2', 'Delta 2 Hz', { type: 'binaural', carrier: 160, beat: 2, mark: '#5a63d8' }, 60, 'Binaural beat · 160 Hz carrier · one tone per ear', { x: 0, y: 0, z: 0 }, ['healing', 'binaural', 'sleep'], 'direct'),
  healing('solfeggio-528', '528 Hz', { type: 'bowl', hz: 528, mark: '#18e0c8' }, 60, 'Solfeggio frequency as a singing bowl · generated', { x: 0.4, y: 1.1, z: 0.3 }, ['healing', 'solfeggio', 'meditation']),
  healing('solfeggio-432', '432 Hz', { type: 'bowl', hz: 432, mark: '#c9a96e' }, 60, 'Singing bowl at 432 Hz · generated', { x: -0.4, y: 1.1, z: 0.3 }, ['healing', 'solfeggio', 'meditation']),
  healing('bowl-396', '396 Hz', { type: 'bowl', hz: 396, mark: '#ff8a3c' }, 60, 'Singing bowl at 396 Hz · generated', { x: 0, y: 1.3, z: -0.2 }, ['healing', 'solfeggio', 'meditation']),
  {
    id: 'wilhelm',
    title: 'Wilhelm Scream',
    artistId: 'waves',
    albumId: 'healing-nature',
    dur: 1.62,
    kind: 'generator',
    spatial: 'mono',
    gen: { type: 'clip', url: `${S}/wilhelm-scream.m4a`, mark: '#c8c2b8' },
    pos: { x: -0.7, y: 1.8, z: 0.15 },
    spec: 'The 1951 Wilhelm scream · 1.6 s',
    licence: 'Wikimedia Commons · CC0',
    tags: ['effect', 'film'],
  },
  ...MOBYGRATIS_TRACKS,
];

export const HEALING_BOWL_IDS = ['solfeggio-528', 'solfeggio-432', 'bowl-396'];
export const HEALING_BINAURAL_IDS = ['theta-6', 'alpha-10', 'delta-2'];
export const HEALING_NATURE_IDS = ['creek', 'rain', 'ocean', 'forest', 'brown-noise', 'pink-noise'];
export const HEALING_TONE_IDS = [...CHAKRA_IDS, ...HEALING_BOWL_IDS, ...HEALING_BINAURAL_IDS];
export const HEALING_ALL_IDS = [...CHAKRA_IDS, ...HEALING_BOWL_IDS, ...HEALING_BINAURAL_IDS, ...HEALING_NATURE_IDS];

export const ALBUMS: Album[] = [
  {
    id: 'more-of-the-same',
    title: 'More Of The Same',
    artistId: 'khensu',
    kind: 'album',
    year: 2008,
    art: `${S}/first-attempt.webp`,
    tracks: ['first-attempt'],
    licence: '© 2008 khėnsu.ñü',
    note: 'The demo, split into five instruments you can move. Switch to the original at any moment.',
  },
  {
    id: 'chopin-nocturnes',
    title: 'Nocturnes, Waltzes & Preludes',
    artistId: 'chopin',
    kind: 'collection',
    year: 2012,
    art: `${W}/chopin/cover.webp`,
    tracks: TRACKS.filter((t) => t.albumId === 'chopin-nocturnes').map((t) => t.id),
    licence: `${CC0} · Musopen`,
    note: 'Public-domain recordings commissioned by Musopen. Each one plays as two sounds, left and right, that you can move apart or around you.',
  },
  {
    id: 'healing-chakras',
    title: 'Chakra tones',
    artistId: 'waves',
    kind: 'collection',
    year: 2026,
    art: '',
    artClass: 'h5',
    tracks: ['all-chakras-3d', ...CHAKRA_IDS],
    licence: 'Generated on your device',
    note: 'Seven planetary tones from the root, below you, to the crown. Play all 7 together in 3D or walk them one by one.',
  },
  {
    id: 'healing-nature',
    title: 'Sleep, focus and healing',
    artistId: 'waves',
    kind: 'collection',
    year: 2026,
    art: '',
    artClass: 'h3',
    tracks: ['all-healing-tones', ...HEALING_BOWL_IDS, ...HEALING_BINAURAL_IDS, ...HEALING_NATURE_IDS],
    licence: 'Generated on your device',
    note: 'Solfeggio bowls, binaural beats, rain, ocean, forest and noise, generated live so they never repeat and never end.',
  },
  {
    id: 'mobygratis-catalogue',
    title: 'mobygratis',
    artistId: 'mobygratis',
    kind: 'collection',
    year: 2026,
    art: '',
    artClass: 'h4',
    tracks: MOBYGRATIS_TRACKS.map((t) => t.id),
    licence: MOBYGRATIS_LICENCE,
    note: `The full mobygratis catalogue, ${MOBYGRATIS.count} instrumentals, each split into its stems. Add any stem to your own song from the bubble. Tracks marked “stems arriving” play as soon as their audio is hosted.`,
  },
];

export const COLLECTIONS: Collection[] = [
  {
    id: 'healing-all',
    title: 'All healing tones',
    desc: 'All 7 chakra tones, 528 · 432 · 396 Hz singing bowls, binaural beats and nature sounds.',
    art: '',
    artClass: 'h1',
    tracks: ['all-healing-tones', ...HEALING_ALL_IDS],
    journey: true,
  },
  {
    id: 'chakra-journey',
    title: 'Chakra journey',
    desc: 'Root to crown, each tone crossfading into the next. 90 seconds, or loop it.',
    art: '',
    artClass: 'h5',
    tracks: CHAKRA_IDS,
    journey: true,
  },
  {
    id: 'night',
    title: 'Night',
    desc: 'Nocturnes and rain for the end of the day.',
    art: '',
    artClass: 'h6',
    tracks: ['chopin-nocturne-op9-no2', 'rain', 'chopin-nocturne-op27-no2', 'chopin-prelude-op28-no15', 'chopin-nocturne-op48-no1', 'ocean'],
  },
  {
    id: 'focus',
    title: 'Focus',
    desc: 'Alpha beats and brown noise under a little piano.',
    art: '',
    artClass: 'h2',
    tracks: ['alpha-10', 'brown-noise', 'chopin-prelude-op28-no7', 'forest', 'chopin-waltz-op69-no1'],
  },
];

// Programmes: everyone hears the same moment. Epochs are fixed so a channel's schedule never moves.
const epoch = Date.UTC(2026, 9, 1, 0, 0, 0);
const programmeOf = (ids: string[]): ProgrammeItem[] =>
  ids.map((trackId) => {
    const t = TRACKS.find((x) => x.id === trackId)!;
    return { trackId, dur: t.kind === 'generator' ? (t.gen?.type === 'tone' ? 12 : 180) : t.dur };
  });

export const CHANNELS: Channel[] = [
  {
    id: 'khensu-radio',
    name: 'khėnsu.ñü radio',
    by: 'nu.waves',
    desc: 'Everything on nu.waves, in one unbroken programme. Join and you hear what everyone else hears, right now.',
    art: `${S}/first-attempt.webp`,
    kind: 'live',
    epoch,
    programme: programmeOf([
      'first-attempt',
      'chopin-nocturne-op9-no2',
      'rain',
      'chopin-waltz-op64-no2',
      'chopin-prelude-op28-no15',
      'ocean',
      'chopin-fantaisie-impromptu',
      'first-attempt',
      'chopin-nocturne-op27-no2',
      'forest',
      'chopin-waltz-op64-no1',
      'chopin-mazurka-op17-no4',
      'chopin-nocturne-op48-no1',
      'brown-noise',
      'chopin-waltz-op69-no1',
      'chopin-prelude-op28-no7',
    ]),
    live: true,
  },
  {
    id: 'nocturnes',
    name: 'Nocturnes',
    by: 'nu.waves',
    artistId: 'chopin',
    desc: 'Chopin, all night, in a concert hall.',
    art: `${W}/chopin/cover.webp`,
    kind: 'live',
    epoch: epoch + 1_000 * 60 * 17,
    programme: programmeOf(TRACKS.filter((t) => t.artistId === 'chopin').map((t) => t.id)),
    live: true,
  },
  {
    id: 'healing-live',
    name: 'Healing',
    by: 'ñü.ŵævẽš healing',
    artistId: 'waves',
    desc: 'Chakra tones, bowls, rain and ocean, around the clock.',
    art: '',
    artClass: 'h1',
    kind: 'live',
    epoch: epoch + 1_000 * 60 * 5,
    programme: programmeOf([...CHAKRA_IDS, 'solfeggio-528', 'rain', 'solfeggio-432', 'ocean', 'bowl-396', 'forest', 'creek']),
    live: true,
  },
  {
    id: 'khensu-channel',
    name: 'khėnsu.ñü',
    by: 'khensu.khensu.nu',
    artistId: 'khensu',
    desc: 'Releases and live sets from khėnsu.ñü. Follow to hear when something new is up.',
    art: `${S}/first-attempt.webp`,
    kind: 'creator',
    releases: ['more-of-the-same'],
    live: false,
  },
  {
    id: 'chopin-channel',
    name: 'Chopin · Musopen',
    by: 'Musopen',
    artistId: 'chopin',
    desc: 'Public-domain recordings of Chopin, released by Musopen for anyone to keep.',
    art: `${W}/chopin/cover.webp`,
    kind: 'creator',
    releases: ['chopin-nocturnes'],
    live: false,
  },
];

export const CATALOGUE = {
  version: 1,
  name: 'nu.waves',
  updated: '2026-10-14',
  artists: ARTISTS,
  albums: ALBUMS,
  tracks: TRACKS,
  collections: COLLECTIONS,
  channels: CHANNELS,
  venues: VENUES,
};
export type Catalogue = typeof CATALOGUE;

export const artistOf = (id: string) => ARTISTS.find((a) => a.id === id);
export const albumOf = (id: string) => ALBUMS.find((a) => a.id === id);
export const trackOf = (id: string) => TRACKS.find((t) => t.id === id);
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
