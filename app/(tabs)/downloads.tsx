import { FONTS } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const ART_SIZE = SW - 64;
const THUMB_R = 6;
const PALETTE = ['#E50914', '#ff6b35', '#f7c59f', '#6ab04c', '#22a6b3', '#4834d4', '#be2edd', '#e84393'];

interface Track { id: string; uri: string; name: string; duration: number; artUri?: string; }

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function artColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function ArtworkView({ track, size, radius = 6 }: { track: Track; size: number; radius?: number }) {
  const c = artColor(track.name);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: c, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {track.artUri
        ? <Image source={{ uri: track.artUri }} style={{ width: size, height: size }} resizeMode="cover" />
        : <Text style={{ color: '#FFFFFF', fontSize: size * 0.38, fontFamily: FONTS.bold }}>{track.name[0]?.toUpperCase() ?? '?'}</Text>
      }
    </View>
  );
}

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const [player] = useState(() => createAudioPlayer(null));
  const status = useAudioPlayerStatus(player);
  const stateRef = useRef({ repeatMode: 'none' as 'none' | 'one' | 'all', shuffled: false, tracks: [] as Track[], idx: null as number | null });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [showFull, setShowFull] = useState(false);
  const [barWidth, setBarWidth] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [expoGoBlocked, setExpoGoBlocked] = useState(false);

  const isPlaying = status.playing;
  const position = Math.round((status.currentTime ?? 0) * 1000);
  const duration = Math.round((status.duration ?? 0) * 1000);

  const track = currentIdx !== null ? tracks[currentIdx] ?? null : null;
  const progress = duration > 0 ? position / duration : 0;
  const fillW = progress * barWidth;
  const thumbLeft = Math.max(0, Math.min(barWidth - THUMB_R * 2, fillW - THUMB_R));
  const color = track ? artColor(track.name) : '#E50914';

  useEffect(() => { stateRef.current = { repeatMode, shuffled, tracks, idx: currentIdx }; },
    [repeatMode, shuffled, tracks, currentIdx]);

  const scanLibrary = useCallback(async () => {
    setScanning(true);
    setPermDenied(false);
    setExpoGoBlocked(false);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') { setPermDenied(true); setScanning(false); return; }
      let all: Track[] = [];
      let after: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const page = await MediaLibrary.getAssetsAsync({ mediaType: MediaLibrary.MediaType.audio, first: 300, after, sortBy: MediaLibrary.SortBy.default });
        all = [...all, ...page.assets.map((a) => ({ id: a.id, uri: a.uri, name: a.filename.replace(/\.[^/.]+$/, ''), duration: Math.round(a.duration * 1000), artUri: Platform.OS === 'android' && a.albumId ? `content://media/external/audio/albumart/${a.albumId}` : undefined }))];
        hasMore = page.hasNextPage;
        after = page.endCursor;
      }
      all.sort((a, b) => a.name.localeCompare(b.name));
      setTracks(all);
    } catch (e: any) {
      if (e?.message?.includes('AUDIO') || e?.message?.includes('ExpoMediaLibrary') || e?.message?.includes('not declared')) {
        setExpoGoBlocked(true);
      } else {
        setPermDenied(true);
      }
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    });
    scanLibrary();
    return () => { player.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status.didJustFinish) handleEnd();
  }, [status.didJustFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrack = useCallback((index: number, list?: Track[]) => {
    const trks = list ?? stateRef.current.tracks;
    if (index < 0 || index >= trks.length) return;
    setCurrentIdx(index);
    player.replace({ uri: trks[index].uri });
    player.play();
  }, [player]);

  const handleEnd = useCallback(() => {
    const { repeatMode: rm, shuffled: sh, tracks: trks, idx } = stateRef.current;
    if (idx === null) return;
    if (rm === 'one') { player.seekTo(0); player.play(); return; }
    let next = sh ? Math.floor(Math.random() * trks.length) : idx + 1;
    if (!sh && next >= trks.length) { if (rm === 'all') next = 0; else return; }
    loadTrack(next, trks);
  }, [player, loadTrack]);

  const togglePlay = useCallback(() => {
    if (isPlaying) player.pause();
    else player.play();
  }, [isPlaying, player]);

  const skipTo = useCallback((index: number) => { loadTrack(index); }, [loadTrack]);

  const seekTo = useCallback((x: number) => {
    if (duration <= 0) return;
    player.seekTo((Math.max(0, Math.min(1, x / barWidth)) * duration) / 1000);
  }, [duration, barWidth, player]);

  const renderTrack = useCallback(({ item, index }: { item: Track; index: number }) => {
    const active = currentIdx === index;
    return (
      <TouchableOpacity style={[styles.row, active && styles.rowActive]} activeOpacity={0.7} onPress={() => loadTrack(index)}>
        <View>
          <ArtworkView track={item} size={46} />
          {active && isPlaying && (
            <View style={styles.playingOverlay}>
              <Ionicons name="musical-note" size={13} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.rowTexts}>
          <Text style={[styles.rowName, active && styles.rowNameActive]} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowArtist} numberOfLines={1}>Unknown Artist</Text>
        </View>
        <Text style={styles.rowDuration}>{fmtMs(item.duration)}</Text>
      </TouchableOpacity>
    );
  }, [currentIdx, isPlaying, loadTrack]);

  const emptyContent = expoGoBlocked ? (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="construct-outline" size={36} color="#3a3a3a" />
      </View>
      <Text style={styles.emptyTitle}>Development Build Required</Text>
      <Text style={styles.emptySub}>Expo Go cannot access the full media library on Android. Build a development build to use the music player.</Text>
    </View>
  ) : permDenied ? (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="lock-closed-outline" size={36} color="#3a3a3a" />
      </View>
      <Text style={styles.emptyTitle}>Access Denied</Text>
      <Text style={styles.emptySub}>Allow media library access in Settings to see your music.</Text>
      <TouchableOpacity onPress={scanLibrary} style={styles.retryBtn} activeOpacity={0.75}>
        <Text style={styles.retryTxt}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="musical-notes-outline" size={38} color="#3a3a3a" />
      </View>
      <Text style={styles.emptyTitle}>No Audio Files Found</Text>
      <Text style={styles.emptySub}>No audio files were found on your device.</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>Music</Text>
        {scanning
          ? <ActivityIndicator color="#8c8c8c" style={{ marginRight: 4 }} />
          : <TouchableOpacity onPress={scanLibrary} style={styles.addBtn} activeOpacity={0.7}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
        }
      </View>

      {tracks.length > 0 && (
        <Text style={styles.countTxt}>{tracks.length} song{tracks.length !== 1 ? 's' : ''}</Text>
      )}

      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        renderItem={renderTrack}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: track ? 88 : 24 }}
        ListEmptyComponent={!scanning ? emptyContent : null}
      />

      {/* ── Mini player ── */}
      {track && (
        <TouchableOpacity style={[styles.mini, { bottom: (insets.bottom || 8) + 4 }]} activeOpacity={0.95} onPress={() => setShowFull(true)}>
          <LinearGradient colors={['rgba(30,30,32,0.98)', 'rgba(18,18,20,0.98)']} style={StyleSheet.absoluteFill} />
          <ArtworkView track={track} size={42} />
          <Text style={styles.miniName} numberOfLines={1}>{track.name}</Text>
          <View style={styles.miniCtrl}>
            <TouchableOpacity onPress={() => skipTo((currentIdx ?? 0) - 1)} hitSlop={10}>
              <Ionicons name="play-skip-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} hitSlop={10}>
              <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={36} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skipTo((currentIdx ?? 0) + 1)} hitSlop={10}>
              <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.miniBar}>
            <View style={[styles.miniBarFill, { width: `${progress * 100}%` as any, backgroundColor: color }]} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Full player modal ── */}
      <Modal visible={showFull} animationType="slide" transparent={false} statusBarTranslucent>
        <View style={styles.full}>
          {track?.artUri && <Image source={{ uri: track.artUri }} style={StyleSheet.absoluteFill} blurRadius={60} />}
          <LinearGradient
            colors={track?.artUri ? ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', '#000'] : [`${color}55`, '#080808', '#000000']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Handle / header */}
          <View style={[styles.fullHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setShowFull(false)} hitSlop={12}>
              <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullHeaderTxt}>Now Playing</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Artwork */}
          <View style={styles.fullArtWrap}>
            {track && <ArtworkView track={track} size={ART_SIZE} radius={18} />}
          </View>

          {/* Track info */}
          <View style={styles.fullInfo}>
            <Text style={styles.fullName} numberOfLines={1}>{track?.name ?? ''}</Text>
            <Text style={styles.fullSub}>Audio</Text>
          </View>

          {/* Seek */}
          <View style={styles.seekWrap} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
            <View
              style={styles.seekTrack}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => seekTo(e.nativeEvent.locationX)}
              onResponderMove={(e) => seekTo(e.nativeEvent.locationX)}
            >
              <View style={styles.seekRail} />
              <View style={[styles.seekFill, { width: fillW, backgroundColor: color }]} />
              <View style={[styles.seekThumb, { left: thumbLeft, backgroundColor: color }]} />
            </View>
            <View style={styles.seekTimes}>
              <Text style={styles.timeText}>{fmtMs(position)}</Text>
              <Text style={styles.timeText}>{fmtMs(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={() => setShuffled((v) => !v)} style={styles.iconBtn}>
              <Ionicons name="shuffle" size={22} color={shuffled ? color : '#555'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skipTo((currentIdx ?? 0) - 1)} style={styles.iconBtn}>
              <Ionicons name="play-skip-back" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={styles.bigBtn}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skipTo((currentIdx ?? 0) + 1)} style={styles.iconBtn}>
              <Ionicons name="play-skip-forward" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRepeatMode((v) => v === 'none' ? 'all' : v === 'all' ? 'one' : 'none')}
              style={styles.iconBtn}
            >
              <Ionicons name={repeatMode === 'one' ? 'repeat-outline' : 'repeat'} size={22} color={repeatMode !== 'none' ? color : '#555'} />
              {repeatMode === 'one' && <View style={[styles.repeatDot, { backgroundColor: color }]} />}
            </TouchableOpacity>
          </View>

          <View style={{ height: Math.max(insets.bottom, 24) }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  title: { color: '#FFFFFF', fontSize: 28, fontFamily: FONTS.bold },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  rowActive: { backgroundColor: '#0e0e0e' },
  rowTexts: { flex: 1 },
  rowName: { color: '#E5E5E5', fontSize: 15, fontFamily: FONTS.regular },
  rowNameActive: { color: '#FFFFFF', fontFamily: FONTS.semiBold },
  rowArtist: { color: '#555', fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  playingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#1c1c1e', marginLeft: 74 },

  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: FONTS.bold, marginBottom: 8 },
  emptySub: { color: '#8c8c8c', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1c1c1e', borderWidth: 0.5, borderColor: '#3a3a3a' },
  retryTxt: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semiBold },
  countTxt: { color: '#8c8c8c', fontSize: 13, fontFamily: FONTS.regular, paddingHorizontal: 20, marginBottom: 4 },
  rowDuration: { color: '#555', fontSize: 13, fontFamily: FONTS.regular },

  mini: { position: 'absolute', left: 12, right: 12, height: 68, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: '#2c2c2e' },
  miniName: { flex: 1, color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semiBold },
  miniCtrl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#2c2c2e' },
  miniBarFill: { height: 2 },

  full: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  fullHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  fullHeaderTxt: { flex: 1, color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold, textAlign: 'center' },
  fullArtWrap: { marginTop: 20, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.6, shadowRadius: 32, elevation: 24 },
  fullInfo: { width: '100%', paddingHorizontal: 32, marginTop: 28, gap: 4 },
  fullName: { color: '#FFFFFF', fontSize: 22, fontFamily: FONTS.bold },
  fullSub: { color: '#8c8c8c', fontSize: 15, fontFamily: FONTS.regular },

  seekWrap: { width: '100%', paddingHorizontal: 32, marginTop: 22 },
  seekTrack: { height: 32, justifyContent: 'center' },
  seekRail: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: '#3a3a3c' },
  seekFill: { position: 'absolute', left: 0, height: 3, borderRadius: 2 },
  seekThumb: { position: 'absolute', top: '50%', marginTop: -THUMB_R, width: THUMB_R * 2, height: THUMB_R * 2, borderRadius: THUMB_R },
  seekTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  timeText: { color: '#8c8c8c', fontSize: 11, fontFamily: FONTS.regular },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, marginTop: 24 },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  bigBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  repeatDot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },
});
