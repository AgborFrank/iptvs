import { FONTS } from '@/constants/fonts';
import { clearSourceCache, fetchFromSources, getGroups, type Channel } from '@/services/iptv';
import { SPORTSRC_API_KEY } from '@/services/sportsrc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const GAP = 10;
const COLS = 2;
const TILE_W = (SW - 32 - GAP) / COLS;
const TILE_H = TILE_W * 0.58;

function ShimmerGrid() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-TILE_W * 2.5, TILE_W * 2.5],
  });

  const shimmerBar = (
    <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );

  return (
    <>
      {/* Pills shimmer */}
      <View style={styles.shimmerPillsRow}>
        {[72, 56, 88, 64, 52, 78].map((w, i) => (
          <View key={i} style={[styles.shimmerPill, { width: w }]}>{shimmerBar}</View>
        ))}
      </View>

      {/* Tile grid shimmer */}
      <View style={styles.shimmerGrid}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={styles.shimmerTile}>
            <View style={styles.shimmerThumb}>{shimmerBar}</View>
            <View style={styles.shimmerBody}>
              <View style={styles.shimmerLine}>{shimmerBar}</View>
              <View style={[styles.shimmerLine, { width: '52%' }]}>{shimmerBar}</View>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('All');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFromSources(['sports'])
      .then((data) => { setChannels(data); setLoading(false); })
      .catch((err: Error) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => getGroups(channels), [channels]);

  const filtered = useMemo(() =>
    selectedGroup === 'All' ? channels : channels.filter((c) => c.group === selectedGroup),
    [channels, selectedGroup],
  );

  const openChannel = useCallback((ch: Channel) => {
    router.push({ pathname: '/player', params: { url: ch.url, name: ch.name, logo: ch.logo, group: ch.group } });
  }, []);

  const renderChannel = useCallback(({ item }: { item: Channel }) => (
    <TouchableOpacity style={styles.tile} activeOpacity={0.75} onPress={() => openChannel(item)}>
      <View style={styles.tileInner}>
        {/* Blurred background */}
        {item.logo && (
          <Image source={{ uri: item.logo }} style={styles.tileBlurBg} blurRadius={18} resizeMode="cover" fadeDuration={0} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.78)']}
          style={styles.tileOverlay}
        />

        {/* Logo */}
        <View style={styles.tileThumb}>
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.tileLogo} resizeMode="contain" fadeDuration={0} />
          ) : (
            <View style={styles.tileLogoFallback}>
              <Ionicons name="football-outline" size={32} color="#3a3a3a" />
            </View>
          )}
        </View>

        {/* Name + group */}
        <View style={styles.tileInfo}>
          <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.tileGroup} numberOfLines={1}>{item.group}</Text>
        </View>

        {/* LIVE badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTxt}>LIVE</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [openChannel]);

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sports</Text>
          <View style={styles.liveHeaderBadge}>
            <View style={styles.liveDotHeader} />
            <Text style={styles.liveHeaderTxt}>LIVE</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!loading && !error && (
            <Text style={styles.channelCount}>{filtered.length} ch</Text>
          )}
          <TouchableOpacity
            style={styles.matchesBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/matches')}
          >
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
            {!SPORTSRC_API_KEY && <View style={styles.matchesDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false}>
          <ShimmerGrid />
        </ScrollView>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color="#444" />
          <Text style={styles.errorTxt}>Failed to load</Text>
          <Text style={styles.hint}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { clearSourceCache('sports'); load(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Group filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContent}
            style={styles.pillsRow}
          >
            {groups.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.pill, selectedGroup === g && styles.pillActive]}
                onPress={() => setSelectedGroup(g)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillTxt, selectedGroup === g && styles.pillTxtActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Channel grid */}
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderChannel}
            numColumns={COLS}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={12}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="football-outline" size={48} color="#444" />
                <Text style={styles.hint}>No channels in this category</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
  },
  liveHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E50914',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  liveDotHeader: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveHeaderTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
  },
  channelCount: {
    color: '#8c8c8c',
    fontSize: 12,
    fontFamily: FONTS.regular,
  },

  // Pills
  pillsRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  pillsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    height: 30,
    borderWidth: 1,
    borderColor: '#3a3a3a',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  pillTxt: {
    color: '#AAAAAA',
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    includeFontPadding: false,
  },
  pillTxtActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },

  // Grid
  grid: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  gridRow: {
    gap: GAP,
    marginBottom: GAP,
  },
  tile: {
    width: TILE_W,
    borderRadius: 8,
    overflow: 'visible',
  },
  tileInner: {
    width: TILE_W,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1c1c1c',
  },
  tileBlurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tileThumb: {
    width: TILE_W,
    height: TILE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLogo: {
    width: TILE_W - 20,
    height: TILE_H - 16,
  },
  tileLogoFallback: {
    width: TILE_W,
    height: TILE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(229,9,20,0.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveTxt: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
  },
  tileInfo: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  tileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  tileGroup: {
    color: '#8c8c8c',
    fontSize: 11,
    fontFamily: FONTS.regular,
  },

  // Shimmer
  shimmerPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  shimmerPill: {
    height: 30,
    borderRadius: 14,
    backgroundColor: '#1c1c1c',
    overflow: 'hidden',
  },
  shimmerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  shimmerTile: {
    width: TILE_W,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1c1c1c',
  },
  shimmerThumb: {
    width: TILE_W,
    height: TILE_H,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  shimmerBody: {
    padding: 10,
    gap: 6,
  },
  shimmerLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: '#272727',
    width: '78%',
    overflow: 'hidden',
  },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 60,
  },
  hint: {
    color: '#8c8c8c',
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  matchesBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#1c1c1c',
    borderRadius: 18,
  },
  matchesDot: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E50914',
  },
  errorTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 11,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  retryTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
});
