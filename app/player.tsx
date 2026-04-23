import { FONTS } from '@/constants/fonts';
import { DEFAULT_SOURCE_IDS, fetchFromSources, type Channel } from '@/services/iptv';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as NavigationBar from 'expo-navigation-bar';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { openBrowserAsync } from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video, { VideoRef } from 'react-native-video';

const HIDE_DELAY = 4000;
const THUMB_R = 7;

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function isYouTubeUrl(u: string) {
  return u.includes('youtube.com') || u.includes('youtu.be');
}

function detectStreamType(u: string): 'hls' | 'mpd' | undefined {
  const lower = u.toLowerCase().split('?')[0];
  if (lower.endsWith('.mpd') || lower.includes('/dash/')) return 'mpd';
  if (
    lower.endsWith('.m3u8') ||
    lower.includes('/hls/') ||
    lower.includes('chunklist') ||
    lower.includes('master.m3u8') ||
    lower.includes('playlist.m3u8') ||
    lower.includes('index.m3u8')
  ) return 'hls';
  return undefined;
}

// A TV-like UA avoids CDN blocks (Samsung, Pluto, Stirr, etc. check User-Agent)
const STREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) SamsungBrowser/2.1 TV Safari/538.1',
};

const MAX_RETRIES = 3;

export default function PlayerScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { url, name, logo, group } = useLocalSearchParams<{ url: string; name: string; logo: string; group: string }>();

  const isLandscape = W > H;
  const VIDEO_H = W * (9 / 16);
  const isYouTube = !!url && isYouTubeUrl(url);

  const videoRef = useRef<VideoRef>(null);

  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [barWidth, setBarWidth] = useState(1);
  const [similarChannels, setSimilarChannels] = useState<Channel[]>([]);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isPlaying = !paused;
  const isLoading = !isReady || buffering;
  const isLive = !Number.isFinite(duration) || duration <= 0;
  const progress = isLive ? 0 : Math.max(0, Math.min(1, currentTime / duration));
  const fillW = progress * barWidth;
  const thumbLeft = Math.max(0, Math.min(barWidth - THUMB_R * 2, fillW - THUMB_R));

  useEffect(() => {
    if (!hasError || retryCount >= MAX_RETRIES || isYouTube) return;
    const timer = setTimeout(() => {
      setHasError(false);
      setIsReady(false);
      setBuffering(true);
      setRetryKey((k) => k + 1);
      setRetryCount((v) => v + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [hasError, retryCount, isYouTube]);

  const manualRetry = useCallback(() => {
    setRetryCount(0);
    setHasError(false);
    setIsReady(false);
    setBuffering(true);
    setRetryKey((k) => k + 1);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), HIDE_DELAY);
  }, []);

  const reveal = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideTimer.current);
  }, [scheduleHide]);

  const handleScreenTap = useCallback(() => {
    if (showControls) { setShowControls(false); } else { reveal(); }
  }, [showControls, reveal]);

  const togglePlay = useCallback(() => {
    setPaused((p) => !p);
    reveal();
  }, [reveal]);

  const skipBy = useCallback((secs: number) => {
    if (!isLive) videoRef.current?.seek(Math.max(0, currentTime + secs));
    reveal();
  }, [isLive, currentTime, reveal]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
    reveal();
  }, [reveal]);

  const seekTo = useCallback((x: number) => {
    if (isLive || barWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    videoRef.current?.seek(ratio * duration);
  }, [barWidth, duration, isLive]);

  const toggleOrientation = useCallback(async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      await NavigationBar.setVisibilityAsync('visible');
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      await NavigationBar.setVisibilityAsync('hidden');
      await NavigationBar.setBehaviorAsync('overlay-swipe');
    }
    reveal();
  }, [isLandscape, reveal]);

  useEffect(() => {
    fetchFromSources(DEFAULT_SOURCE_IDS)
      .then((all) => {
        const similar = all.filter((c) => c.group === group && c.url !== url);
        setSimilarChannels(similar.slice(0, 40));
      })
      .catch(() => {});
  }, [group, url]);

  const renderSimilar = useCallback(({ item }: { item: Channel }) => (
    <TouchableOpacity
      style={styles.similarCard}
      activeOpacity={0.75}
      onPress={() => router.replace({ pathname: '/player', params: { url: item.url, name: item.name, logo: item.logo ?? '', group: item.group } })}
    >
      <View style={styles.similarThumb}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.similarLogo} resizeMode="contain" />
        ) : (
          <Text style={styles.similarInitials}>{item.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <Text style={styles.similarName} numberOfLines={2}>{item.name}</Text>
    </TouchableOpacity>
  ), []);

  const handleBack = useCallback(async () => {
    await NavigationBar.setVisibilityAsync('visible');
    await ScreenOrientation.unlockAsync();
    router.back();
  }, []);

  const seekBar = (
    <View
      style={styles.seekRow}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width - 96)}
    >
      <Text style={styles.timeText}>{fmt(currentTime)}</Text>
      <View
        style={styles.seekTrack}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => seekTo(e.nativeEvent.locationX)}
        onResponderMove={(e) => seekTo(e.nativeEvent.locationX)}
      >
        <View style={styles.seekRail} />
        <View style={[styles.seekFill, { width: fillW }]} />
        <View style={[styles.seekThumb, { left: thumbLeft }]} />
      </View>
      <Text style={styles.timeText}>{fmt(duration)}</Text>
    </View>
  );

  const videoOverlays = (
    <>
      {!hasError && isLoading && (
        <View style={styles.centeredOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.bufferText}>Connecting...</Text>
        </View>
      )}
      {hasError && (
        <View style={styles.centeredOverlay}>
          {retryCount < MAX_RETRIES ? (
            <>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.errorTitle}>Stream interrupted</Text>
              <Text style={styles.errorSub}>Retrying… ({retryCount + 1}/{MAX_RETRIES})</Text>
            </>
          ) : (
            <>
              <Ionicons name="warning-outline" size={52} color="#E50914" />
              <Text style={styles.errorTitle}>Stream unavailable</Text>
              <Text style={styles.errorSub}>This channel may be geo-blocked or temporarily offline.</Text>
              <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={manualRetry}>
                <Ionicons name="reload" size={16} color="#FFFFFF" />
                <Text style={styles.retryTxt}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.retryBtn, { marginTop: 0 }]} activeOpacity={0.8} onPress={() => openBrowserAsync(url ?? '')}>
                <Ionicons name="globe-outline" size={16} color="#FFFFFF" />
                <Text style={styles.retryTxt}>Open in browser</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      {isYouTube && (
        <View style={styles.centeredOverlay}>
          <Ionicons name="logo-youtube" size={56} color="#FF0000" />
          <Text style={styles.errorTitle}>{name}</Text>
          <Text style={styles.errorSub}>This channel streams via YouTube and cannot be played inline.</Text>
          <TouchableOpacity style={styles.openYouTubeBtn} activeOpacity={0.8} onPress={() => Linking.openURL(url ?? '')}>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.openYouTubeTxt}>Open in YouTube</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const videoEl = !isYouTube && (
    <Video
      key={retryKey}
      ref={videoRef}
      source={{ uri: url ?? '', type: detectStreamType(url ?? ''), headers: STREAM_HEADERS }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      paused={paused}
      muted={isMuted}
      repeat={false}
      controls={false}
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="ignore"
      bufferConfig={{
        minBufferMs: 3000,
        maxBufferMs: 50000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000,
      }}
      onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
      onError={() => setHasError(true)}
      onLoad={({ duration: d }) => {
        setDuration(Number.isFinite(d) ? d : 0);
        setIsReady(true);
        setHasError(false);
      }}
      onProgress={({ currentTime: t }) => setCurrentTime(Number.isFinite(t) ? t : 0)}
      onReadyForDisplay={() => { setIsReady(true); setBuffering(false); }}
    />
  );

  // ── LANDSCAPE: full-screen ────────────────────────────────────────────────
  if (isLandscape) {
    return (
      <View style={{ width: W, height: H, backgroundColor: '#000' }}>
        <StatusBar hidden />
        {videoEl}
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={StyleSheet.absoluteFill}>
            {showControls && (
              <View style={styles.controlsWrapper} pointerEvents="box-none">
                <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
                  <TouchableOpacity onPress={handleBack} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.channelName} numberOfLines={1}>{name}</Text>
                  <TouchableOpacity onPress={toggleMute} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleOrientation} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="contract" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.middleArea} pointerEvents="box-none">
                  {!isLive && (
                    <TouchableOpacity onPress={() => skipBy(-10)} style={styles.skipBtn} activeOpacity={0.7}>
                      <Ionicons name="play-back-outline" size={30} color="#FFFFFF" />
                      <Text style={styles.skipLabel}>10</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={togglePlay} style={styles.playBtn} activeOpacity={0.7}>
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#000000" />
                  </TouchableOpacity>
                  {!isLive && (
                    <TouchableOpacity onPress={() => skipBy(10)} style={styles.skipBtn} activeOpacity={0.7}>
                      <Ionicons name="play-forward-outline" size={30} color="#FFFFFF" />
                      <Text style={styles.skipLabel}>10</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} pointerEvents="box-none">
                  {isLive ? (
                    <View style={styles.liveRow}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                  ) : seekBar}
                </View>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
        {videoOverlays}
      </View>
    );
  }

  // ── PORTRAIT: YouTube style ───────────────────────────────────────────────
  return (
    <View style={[styles.portraitContainer, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* 16:9 video */}
      <View style={[styles.videoBox, { height: VIDEO_H }]}>
        {videoEl}
        <TouchableWithoutFeedback onPress={handleScreenTap}>
          <View style={StyleSheet.absoluteFill}>
            {showControls && (
              <>
                <LinearGradient
                  colors={['rgba(0,0,0,0.65)', 'transparent', 'rgba(0,0,0,0.45)']}
                  locations={[0, 0.4, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.portraitTopBar}>
                  <TouchableOpacity onPress={handleBack} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={toggleOrientation} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="expand" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableWithoutFeedback>
        {videoOverlays}
      </View>

      {/* Info + controls panel */}
      <View style={styles.infoPanel}>
        {!!logo && (
          <Image source={{ uri: logo }} style={StyleSheet.absoluteFill} blurRadius={22} resizeMode="cover" />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.52)', 'rgba(0,0,0,0.94)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.infoPanelContent, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>

          {/* Channel row */}
          <View style={styles.channelRow}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoThumb} resizeMode="contain" />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoInitials}>{(name ?? '?').slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.portraitName} numberOfLines={1}>{name}</Text>
              {isLive && (
                <View style={styles.liveBadgeRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={toggleMute} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Seek bar (VOD only) */}
          {!isLive && seekBar}

          {/* Similar channels */}
          {similarChannels.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.similarTitle}>More in {group}</Text>
              <FlatList
                data={similarChannels}
                keyExtractor={(c) => c.id}
                renderItem={renderSimilar}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarList}
              />
            </View>
          )}

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Portrait
  portraitContainer: { flex: 1, backgroundColor: '#000' },
  videoBox: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  portraitTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  infoPanel: { flex: 1, overflow: 'hidden' },
  infoPanelContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  logoThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1c1c1c',
  },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: { color: '#8c8c8c', fontSize: 22, fontFamily: FONTS.bold },
  portraitName: { color: '#FFFFFF', fontSize: 17, fontFamily: FONTS.semiBold, marginBottom: 4 },
  liveBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  similarSection: { marginTop: 16, flex: 1 },
  similarTitle: {
    color: '#8c8c8c',
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  similarList: { paddingRight: 20 },
  similarCard: { width: 90, marginRight: 10 },
  similarThumb: {
    width: 90,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    overflow: 'hidden',
  },
  similarLogo: { width: 82, height: 52 },
  similarInitials: { color: '#555', fontSize: 16, fontFamily: FONTS.bold },
  similarName: { color: '#CCCCCC', fontSize: 10, fontFamily: FONTS.regular, lineHeight: 13 },

  // Shared
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  bufferText: { color: '#8c8c8c', fontSize: 14 },
  errorTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: FONTS.bold, textAlign: 'center' },
  errorSub: { color: '#8c8c8c', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Landscape controls
  controlsWrapper: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  channelName: { flex: 1, color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.semiBold, marginHorizontal: 4 },
  middleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  skipBtn: { alignItems: 'center', gap: 2, paddingHorizontal: 8 },
  skipLabel: { color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.semiBold },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bottomBar: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E50914' },
  liveText: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.bold, letterSpacing: 1 },
  seekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  timeText: { color: '#FFFFFF', fontSize: 12, minWidth: 42, textAlign: 'center' },
  seekTrack: { flex: 1, height: 28, justifyContent: 'center' },
  seekRail: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  seekFill: { position: 'absolute', left: 0, height: 3, borderRadius: 2, backgroundColor: '#E50914' },
  seekThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -THUMB_R,
    width: THUMB_R * 2,
    height: THUMB_R * 2,
    borderRadius: THUMB_R,
    backgroundColor: '#FFFFFF',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryTxt: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.semiBold },
  openYouTubeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4, backgroundColor: '#FF0000' },
  openYouTubeTxt: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold },
});
