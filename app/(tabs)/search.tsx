import { FONTS } from '@/constants/fonts';
import {
  DEFAULT_SOURCE_IDS,
  PLAYLIST_SOURCES,
  fetchFromSources,
  type Channel,
  type PlaylistSource,
} from '@/services/iptv';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const COL_GAP = 8;
const TILE_W = (SW - 32 - COL_GAP) / 2;
const LANG_TILE_W = (SW - 32 - COL_GAP * 2) / 3;

const CATEGORY_COLORS: Record<string, string> = {
  news: '#c0392b',
  sports: '#1a6b3c',
  entertainment: '#d35400',
  movies: '#6c3483',
  series: '#5d4037',
  music: '#1565c0',
  kids: '#e67e00',
  animation: '#ad1457',
  comedy: '#e65100',
  documentary: '#00695c',
  education: '#4527a0',
  culture: '#6a1b9a',
  science: '#0277bd',
  business: '#37474f',
  lifestyle: '#2e7d32',
  food: '#bf360c',
  travel: '#0097a7',
  outdoor: '#558b2f',
  family: '#c62828',
  religious: '#4e342e',
  classic: '#424242',
  weather: '#1565c0',
};

const CATEGORIES = PLAYLIST_SOURCES.filter((s) => s.type === 'category');
const LANGUAGES = PLAYLIST_SOURCES.filter((s) => s.type === 'language');

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchFromSources(DEFAULT_SOURCE_IDS)
      .then((data) => { setChannels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return channels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    ).slice(0, 80);
  }, [query, channels]);

  const openChannel = useCallback((ch: Channel) => {
    router.push({ pathname: '/player', params: { url: ch.url, name: ch.name, logo: ch.logo } });
  }, []);

  const browseCategorySource = useCallback((src: PlaylistSource) => {
    setQuery(src.name);
    inputRef.current?.focus();
  }, []);

  const renderResult = useCallback(({ item }: { item: Channel }) => (
    <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={() => openChannel(item)}>
      {item.logo ? (
        <Image source={{ uri: item.logo }} style={styles.resultLogo} resizeMode="contain" />
      ) : (
        <View style={styles.resultLogoFallback}>
          <Text style={styles.resultInitials}>{item.name.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultGroup} numberOfLines={1}>{item.group}</Text>
      </View>
      <Ionicons name="play-circle-outline" size={26} color="#FFFFFF" />
    </TouchableOpacity>
  ), [openChannel]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Search</Text>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#8c8c8c" />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search channels, groups, languages…"
          placeholderTextColor="#8c8c8c"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#8c8c8c" />
          </TouchableOpacity>
        )}
      </View>

      {query.length === 0 ? (
        /* ── Browse mode ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.browseContent}>

          {/* Categories */}
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <View style={styles.tileGrid}>
            {CATEGORIES.map((src) => (
              <TouchableOpacity
                key={src.id}
                style={[styles.categoryTile, { backgroundColor: CATEGORY_COLORS[src.id] ?? '#333333' }]}
                activeOpacity={0.75}
                onPress={() => browseCategorySource(src)}
              >
                <Ionicons name={src.iconName as any} size={22} color="#fff" />
                <Text style={styles.tileName}>{src.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Languages */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Browse by Language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((src) => (
              <TouchableOpacity
                key={src.id}
                style={styles.langTile}
                activeOpacity={0.75}
                onPress={() => browseCategorySource(src)}
              >
                <Image
                  source={{ uri: `https://flagcdn.com/w40/${src.flagCode}.png` }}
                  style={styles.langFlag}
                  resizeMode="cover"
                />
                <Text style={styles.langName}>{src.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      ) : loading ? (
        /* ── Loading channels ── */
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.hint}>Loading channels…</Text>
        </View>
      ) : results.length > 0 ? (
        /* ── Results ── */
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {results.length}{results.length === 80 ? '+' : ''} result{results.length !== 1 ? 's' : ''}
            </Text>
          }
        />
      ) : (
        /* ── No results ── */
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color="#444444" />
          <Text style={styles.noResultsText}>No results for &ldquo;{query}&rdquo;</Text>
          <Text style={styles.hint}>Try a channel name, country or category.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: FONTS.bold,
    marginTop: 8,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    maxHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },

  // Browse
  browseContent: {
    paddingBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
    marginBottom: 12,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
  },
  categoryTile: {
    width: TILE_W,
    height: 76,
    borderRadius: 4,
    padding: 10,
    justifyContent: 'space-between',
  },
  tileEmoji: {
    width: 22,
    height: 22,
  },
  tileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COL_GAP,
  },
  langTile: {
    width: LANG_TILE_W,
    backgroundColor: '#1c1c1c',
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  langFlag: {
    width: 36,
    height: 24,
    borderRadius: 2,
  },
  langName: {
    color: '#CCCCCC',
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },

  // Results
  resultCount: {
    color: '#8c8c8c',
    fontSize: 12,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  resultLogo: {
    width: 56,
    height: 38,
    borderRadius: 2,
    backgroundColor: '#1c1c1c',
  },
  resultLogoFallback: {
    width: 56,
    height: 38,
    borderRadius: 2,
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInitials: {
    color: '#8c8c8c',
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  resultInfo: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  resultGroup: {
    color: '#8c8c8c',
    fontSize: 12,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#1e1e1e',
  },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noResultsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },
  hint: {
    color: '#8c8c8c',
    fontSize: 13,
    textAlign: 'center',
  },
});
