import { FONTS } from '@/constants/fonts';
import { fetchEpg, getNow, type EpgMap } from '@/services/epg';
import {
    DEFAULT_SOURCE_IDS,
    PLAYLIST_SOURCES,
    fetchFromSources,
    fetchFromUrl,
    getEpgUrl,
    getFavorites,
    getGroups,
    getLastChannel,
    loadFromFile,
    saveLastChannel,
    toggleFavorite,
    type Channel,
} from '@/services/iptv';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const COLS = 3;
const GAP = 8;
const TILE_W = (SW - 32 - GAP * (COLS - 1)) / COLS;
const TILE_H = TILE_W * 0.65;

function ShimmerGrid() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SW, SW * 1.5],
  });

  const shimmerOverlay = (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.07)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );

  return (
    <View style={shimStyles.container}>
      {Array.from({ length: 4 }, (_, row) => (
        <View key={row} style={shimStyles.row}>
          {Array.from({ length: COLS }, (_, col) => (
            <View key={col} style={shimStyles.tile}>
              <View style={shimStyles.logo} />
              <View style={shimStyles.name} />
              <View style={shimStyles.sub} />
              {shimmerOverlay}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const shimStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: {
    width: TILE_W,
    height: TILE_H + 32,
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 6,
  },
  logo: { width: TILE_W - 16, height: TILE_H - 20, backgroundColor: '#272727', borderRadius: 3 },
  name: { width: (TILE_W - 16) * 0.65, height: 8, backgroundColor: '#272727', borderRadius: 4 },
  sub:  { width: (TILE_W - 16) * 0.45, height: 6, backgroundColor: '#222', borderRadius: 4 },
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>(DEFAULT_SOURCE_IDS);
  const [showSources, setShowSources] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>(DEFAULT_SOURCE_IDS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [resumeChannel, setResumeChannel] = useState<Channel | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [epg, setEpg] = useState<EpgMap>(new Map());

  useEffect(() => {
    getFavorites().then((ids) => setFavorites(new Set(ids)));
    getLastChannel().then((ch) => { if (ch) setResumeChannel(ch); });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedGroup('All');
    fetchFromSources(activeSourceIds)
      .then((data: Channel[]) => {
        setChannels(data);
        setLoading(false);
        // Background EPG fetch — try the first source that has an EPG URL
        const epgUrl = activeSourceIds.map(getEpgUrl).find(Boolean);
        if (epgUrl) {
          fetchEpg(epgUrl).then(setEpg).catch(() => {});
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeSourceIds]);

  const openSources = useCallback(() => {
    setPendingIds([...activeSourceIds]);
    setShowSources(true);
  }, [activeSourceIds]);

  const togglePending = useCallback((id: string) => {
    setPendingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const applySources = useCallback(() => {
    if (pendingIds.length === 0) return;
    setActiveSourceIds(pendingIds);
    setShowSources(false);
  }, [pendingIds]);

  const onToggleFav = useCallback(async (id: string) => {
    const next = await toggleFavorite(id);
    setFavorites(new Set(next));
  }, []);

  const pickFile = useCallback(async () => {
    setCustomError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setCustomLoading(true);
    try {
      const extra = await loadFromFile(result.assets[0].uri);
      if (extra.length === 0) throw new Error('No channels found in this file');
      setChannels((prev) => {
        const seen = new Set(prev.map((c: Channel) => c.url));
        return [...prev, ...extra.filter((c: Channel) => !seen.has(c.url))];
      });
      setShowSources(false);
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : 'Failed to read file');
    } finally {
      setCustomLoading(false);
    }
  }, []);

  const addCustomPlaylist = useCallback(async () => {
    const url = customUrl.trim();
    if (!url) return;
    setCustomLoading(true);
    setCustomError(null);
    try {
      const extra = await fetchFromUrl(url);
      if (extra.length === 0) throw new Error('No channels found in this URL');
      setChannels((prev) => {
        const seen = new Set(prev.map((c: Channel) => c.url));
        return [...prev, ...extra.filter((c: Channel) => !seen.has(c.url))];
      });
      setCustomUrl('');
      setShowSources(false);
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : 'Failed to load playlist');
    } finally {
      setCustomLoading(false);
    }
  }, [customUrl]);

  const groups = useMemo(
    () => ['❤️ Favorites', ...getGroups(channels)],
    [channels],
  );

  const filtered = useMemo(() => {
    if (selectedGroup === '❤️ Favorites') {
      const fav = channels.filter((c) => favorites.has(c.id));
      if (!searchQuery.trim()) return fav;
      const q = searchQuery.toLowerCase();
      return fav.filter((c) => c.name.toLowerCase().includes(q));
    }
    const byGroup =
      selectedGroup === 'All'
        ? channels
        : channels.filter((c) => c.group === selectedGroup);
    if (!searchQuery.trim()) return byGroup;
    const q = searchQuery.toLowerCase();
    return byGroup.filter(
      (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [channels, selectedGroup, searchQuery, favorites]);

  const renderChannel = useCallback(
    ({ item }: { item: Channel }) => {
      const isFav = favorites.has(item.id);
      const nowProg = getNow(item.tvgId, epg);
      return (
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.7}
          onPress={() => {
            saveLastChannel(item);
            router.push({ pathname: '/player', params: { url: item.url, name: item.name, logo: item.logo, group: item.group } });
          }}
        >
          <View style={styles.tileInner}>
            {item.logo && (
              <Image
                source={{ uri: item.logo }}
                style={styles.tileBlurBg}
                blurRadius={18}
                resizeMode="cover"
                fadeDuration={0}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.72)']}
              style={styles.tileOverlay}
            />
            {item.logo ? (
              <Image source={{ uri: item.logo }} style={styles.tileLogo} resizeMode="contain" fadeDuration={0} />
            ) : (
              <View style={styles.tileLogoFallback}>
                <Text style={styles.tileInitials}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
            {nowProg ? (
              <Text style={styles.tileNow} numberOfLines={1}>{nowProg.title}</Text>
            ) : null}
          </View>
          <Pressable style={styles.heartBtn} onPress={() => onToggleFav(item.id)} hitSlop={6}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={13} color={isFav ? '#E50914' : '#555'} />
          </Pressable>
        </TouchableOpacity>
      );
    },
    [favorites, onToggleFav, epg],
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      {isSearching ? (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#8c8c8c" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels, countries..."
            placeholderTextColor="#8c8c8c"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
          >
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.logo}>ALEIGRO TV</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setIsSearching(true)}>
              <Ionicons name="search-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={openSources}>
              <View style={styles.sourcesBtn}>
                <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
                {activeSourceIds.length > 1 && (
                  <View style={styles.sourcesBadge}>
                    <Text style={styles.sourcesBadgeTxt}>{activeSourceIds.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Resume last channel pill */}
      {resumeChannel && !loading && (
        <View style={styles.resumeBar}>
          <Ionicons name="play-circle" size={16} color="#E50914" />
          <Text style={styles.resumeTxt} numberOfLines={1}>
            Resume: {resumeChannel.name}
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              router.push({ pathname: '/player', params: { url: resumeChannel.url, name: resumeChannel.name, logo: resumeChannel.logo, group: resumeChannel.group } });
              setResumeChannel(null);
            }}
          >
            <Text style={styles.resumePlay}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setResumeChannel(null)}>
            <Ionicons name="close" size={16} color="#555" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ShimmerGrid />
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color="#555555" />
          <Text style={styles.errorText}>Failed to load channels</Text>
          <Text style={styles.errorSub}>{error}</Text>
        </View>
      ) : (
        <>
          {/* Country / Group filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsRow}
          >
            {groups.map((group) => (
              <TouchableOpacity
                key={group}
                style={[styles.pill, selectedGroup === group && styles.pillActive]}
                onPress={() => setSelectedGroup(group)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, selectedGroup === group && styles.pillTextActive]}>
                  {group}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Channel count */}
          <Text style={styles.channelCount}>
            {filtered.length.toLocaleString()} channels
            {activeSourceIds.length > 1 ? ` · ${activeSourceIds.length} playlists` : ''}
          </Text>

          {/* Channel Grid */}
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderChannel}
            numColumns={COLS}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.gridRow}
            windowSize={5}
            maxToRenderPerBatch={12}
            initialNumToRender={18}
            removeClippedSubviews
          />
        </>
      )}
      {/* ── Sources Modal ── */}
      <Modal
        visible={showSources}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSources(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Playlists</Text>
            <TouchableOpacity onPress={() => setShowSources(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {/* Custom playlist URL */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTxt}>Custom URL</Text>
            </View>
            <View style={styles.customUrlRow}>
              <TextInput
                style={styles.customUrlInput}
                placeholder="Paste .m3u / .m3u8 URL…"
                placeholderTextColor="#555"
                value={customUrl}
                onChangeText={(t) => { setCustomUrl(t); setCustomError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!customLoading}
              />
              <TouchableOpacity
                style={[styles.customUrlBtn, customLoading && { opacity: 0.6 }]}
                activeOpacity={0.8}
                onPress={addCustomPlaylist}
                disabled={customLoading}
              >
                {customLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.customUrlBtnTxt}>Load</Text>}
              </TouchableOpacity>
            </View>
            {customError ? (
              <Text style={styles.customUrlError}>{customError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.pickFileBtn, customLoading && { opacity: 0.6 }]}
              activeOpacity={0.8}
              onPress={pickFile}
              disabled={customLoading}
            >
              <Ionicons name="folder-open-outline" size={16} color="#ccc" />
              <Text style={styles.pickFileBtnTxt}>Pick .m3u file from device</Text>
            </TouchableOpacity>

            {(['general', 'category', 'language'] as const).map((type) => {
              const group = PLAYLIST_SOURCES.filter((s) => s.type === type);
              const label = type === 'general' ? 'General' : type === 'category' ? 'By Category' : 'By Language';
              return (
                <React.Fragment key={type}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderTxt}>{label}</Text>
                  </View>
                  {group.map((src) => {
                    const active = pendingIds.includes(src.id);
                    return (
                      <TouchableOpacity
                        key={src.id}
                        style={[styles.sourceRow, active && styles.sourceRowActive]}
                        activeOpacity={0.7}
                        onPress={() => togglePending(src.id)}
                      >
                        {src.type === 'language' && src.flagCode
                          ? <Image source={{ uri: `https://flagcdn.com/w40/${src.flagCode}.png` }} style={styles.sourceFlag} resizeMode="cover" />
                          : <View style={styles.sourceIconWrap}><Ionicons name={src.iconName as any} size={20} color="#8c8c8c" /></View>
                        }
                        <View style={styles.sourceInfo}>
                          <Text style={styles.sourceName}>{src.name}</Text>
                          <Text style={styles.sourceDesc}>{src.description}</Text>
                        </View>
                        <View style={[styles.check, active && styles.checkActive]}>
                          {active && <Ionicons name="checkmark" size={14} color="#000000" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, pendingIds.length === 0 && styles.applyBtnDisabled]}
            activeOpacity={0.8}
            onPress={applySources}
            disabled={pendingIds.length === 0}
          >
            <Text style={styles.applyBtnTxt}>
              Load {pendingIds.length} playlist{pendingIds.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: {
    color: '#E50914',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONTS.bold,
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#4169E1',
  },
  pillsRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  pillsContainer: {
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
    borderColor: '#555555',
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: FONTS.regular,
  },
  pillTextActive: {
    color: '#000000',
    fontFamily: FONTS.bold,
  },
  channelCount: {
    color: '#8c8c8c',
    fontSize: 12,
    fontFamily: FONTS.regular,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  grid: {
    paddingHorizontal: 16,
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
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tileBlurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tileLogo: {
    width: TILE_W - 16,
    height: TILE_H - 20,
    marginBottom: 6,
  },
  tileLogoFallback: {
    width: TILE_W - 16,
    height: TILE_H - 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileInitials: {
    color: '#8c8c8c',
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  tileName: {
    color: '#E5E5E5',
    fontSize: 11,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  tileNow: {
    color: '#8c8c8c',
    fontSize: 9,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8c8c8c',
    fontSize: 14,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  errorSub: {
    color: '#8c8c8c',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  cancelBtn: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.regular,
  },

  // Sources button in header
  sourcesBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcesBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  sourcesBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bold,
  },

  // Sources modal
  modal: {
    flex: 1,
    backgroundColor: '#111111',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  modalList: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderTxt: {
    color: '#8c8c8c',
    fontSize: 11,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e1e1e',
  },
  sourceRowActive: {
    backgroundColor: '#1a1a1a',
  },
  sourceFlag: {
    width: 34,
    height: 22,
    borderRadius: 2,
  },
  sourceIconWrap: {
    width: 36,
    alignItems: 'center',
  },
  sourceInfo: {
    flex: 1,
    gap: 3,
  },
  sourceName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  sourceDesc: {
    color: '#8c8c8c',
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 16,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  applyBtn: {
    margin: 20,
    paddingVertical: 15,
    borderRadius: 6,
    backgroundColor: '#E50914',
    alignItems: 'center',
  },
  applyBtnDisabled: {
    backgroundColor: '#3a3a3a',
  },
  applyBtnTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
  },

  // Heart button on tile
  heartBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 3,
  },

  // Resume pill
  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  resumeTxt: {
    flex: 1,
    color: '#ccc',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  resumePlay: {
    color: '#E50914',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },

  // Custom URL input in modal
  customUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  customUrlInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  customUrlBtn: {
    backgroundColor: '#E50914',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  customUrlBtnTxt: {
    color: '#fff',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  customUrlError: {
    color: '#ff453a',
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  pickFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  pickFileBtnTxt: {
    color: '#ccc',
    fontSize: 13,
  },
});
