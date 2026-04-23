import { FONTS } from '@/constants/fonts';
import {
    SPORTSRC_API_KEY,
    fetchLiveMatches,
    fetchMatchDetail,
    fetchUpcomingMatches,
    type SportsMatch,
} from '@/services/sportsrc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function hexAlpha(hex: string, alpha: number): string {
  const base = hex.startsWith('#') ? hex : `#${hex}`;
  if (base.length !== 7) return base;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${base}${a}`;
}

type Tab = 'live' | 'upcoming';

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('live');
  const [live, setLive] = useState<SportsMatch[]>([]);
  const [upcoming, setUpcoming] = useState<SportsMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStreamId, setLoadingStreamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noKey = !SPORTSRC_API_KEY;

  useEffect(() => {
    if (noKey) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([fetchLiveMatches(), fetchUpcomingMatches()])
      .then(([l, u]) => { setLive(l); setUpcoming(u); setLoading(false); })
      .catch((err: Error) => { setError(err.message); setLoading(false); });
  }, [noKey]);

  const watchMatch = useCallback(async (match: SportsMatch) => {
    setLoadingStreamId(match.id);
    try {
      const detail = await fetchMatchDetail(match.id);
      if (detail.stream_url) {
        router.push({ pathname: '/match-stream', params: { url: detail.stream_url, title: `${match.home.name} vs ${match.away.name}` } });
      } else {
        setError('No stream available for this match.');
      }
    } catch {
      setError('Could not load stream.');
    } finally {
      setLoadingStreamId(null);
    }
  }, []);

  const matches = tab === 'live' ? live : upcoming;

  const renderMatch = useCallback(({ item }: { item: SportsMatch }) => {
    const isLive = item.status === 'inprogress';
    const isLoadingThis = loadingStreamId === item.id;
    const homeColor = item.home.color || '#1a3a8f';
    const awayColor = item.away.color || '#8f1a1a';

    return (
      <TouchableOpacity
        style={styles.cardOuter}
        activeOpacity={0.88}
        onPress={() => watchMatch(item)}
        disabled={!!loadingStreamId}
      >
        <View style={styles.card}>
          {/* Team colour accent bar */}
          <LinearGradient
            colors={[homeColor, awayColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.colorBar}
          />

          <View style={styles.cardContent}>
            {/* Competition */}
            <Text style={styles.competition}>{item.competition}</Text>

            {/* Teams row */}
            <View style={styles.teamsRow}>
              {/* Home */}
              <View style={styles.teamCol}>
                {item.home.logo ? (
                  <Image source={{ uri: item.home.logo }} style={styles.teamLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.teamLogoFallback, { backgroundColor: hexAlpha(homeColor, 0.3) }]}>
                    <Text style={styles.teamInitial}>{item.home.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.teamName} numberOfLines={2}>{item.home.name}</Text>
              </View>

              {/* Score / Time */}
              <View style={styles.scoreCol}>
                {isLive ? (
                  <>
                    <View style={styles.liveChip}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveMin}>{item.minute ?? 'LIVE'}&apos;</Text>
                    </View>
                    <Text style={styles.score}>
                      {item.home.score ?? 0} – {item.away.score ?? 0}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.kickoff}>{item.kickoff ?? '--:--'}</Text>
                    <Text style={styles.vs}>vs</Text>
                  </>
                )}
              </View>

              {/* Away */}
              <View style={styles.teamCol}>
                {item.away.logo ? (
                  <Image source={{ uri: item.away.logo }} style={styles.teamLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.teamLogoFallback, { backgroundColor: hexAlpha(awayColor, 0.3) }]}>
                    <Text style={styles.teamInitial}>{item.away.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.teamName} numberOfLines={2}>{item.away.name}</Text>
              </View>
            </View>

            {/* Watch button */}
            <View style={[styles.watchBtn, isLoadingThis && styles.watchBtnLoading]}>
              {isLoadingThis ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.watchTxt}>{isLive ? 'Watch Live' : 'Watch'}</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [loadingStreamId, watchMatch]);

  const keyExtractor = useCallback((item: SportsMatch) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Football Matches</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* No API key state */}
      {noKey ? (
        <View style={styles.center}>
          <Ionicons name="key-outline" size={52} color="#555" />
          <Text style={styles.emptyTitle}>API Key Required</Text>
          <Text style={styles.emptyDesc}>
            Get a free SportSRC API key (1,000 req/day) and add it to{'\n'}
            <Text style={styles.codePath}>services/sportsrc.ts</Text>
          </Text>
          <TouchableOpacity
            style={styles.getKeyBtn}
            activeOpacity={0.8}
            onPress={() => Linking.openURL('https://sportsrc.org/v2/#pricing')}
          >
            <Text style={styles.getKeyTxt}>Get Free API Key</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Tab switcher */}
          <View style={styles.tabs}>
            {(['live', 'upcoming'] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
                activeOpacity={0.7}
              >
                {t === 'live' && tab === 'live' && <View style={styles.tabLiveDot} />}
                <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
                  {t === 'live' ? `Live${live.length ? ` (${live.length})` : ''}` : 'Upcoming'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Error inline */}
          {error && (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle-outline" size={16} color="#E50914" />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#E50914" />
              <Text style={styles.hint}>Loading matches…</Text>
            </View>
          ) : matches.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="football-outline" size={52} color="#333" />
              <Text style={styles.emptyTitle}>
                {tab === 'live' ? 'No live matches right now' : 'No upcoming matches today'}
              </Text>
              <Text style={styles.hint}>Check back later</Text>
            </View>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={keyExtractor}
              renderItem={renderMatch}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 17, fontFamily: FONTS.bold },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1c1c1c',
  },
  tabBtnActive: { backgroundColor: '#E50914' },
  tabLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  tabTxt: { color: '#8c8c8c', fontSize: 14, fontFamily: FONTS.semiBold },
  tabTxtActive: { color: '#FFFFFF' },

  // Error bar
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#1c0a0a',
    borderRadius: 6,
  },
  errorTxt: { color: '#E50914', fontSize: 13, flex: 1 },

  // List
  list: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 32 },
  separator: { height: 14 },

  // Match card
  cardOuter: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  colorBar: {
    height: 3,
  },
  cardContent: {
    padding: 14,
    gap: 12,
  },
  competition: {
    color: '#8c8c8c',
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamLogo: { width: 52, height: 52 },
  teamLogoFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamInitial: { color: '#8c8c8c', fontSize: 16, fontFamily: FONTS.bold },
  teamName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
    lineHeight: 17,
  },

  scoreCol: {
    width: 80,
    alignItems: 'center',
    gap: 6,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229,9,20,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.4)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E50914' },
  liveMin: { color: '#E50914', fontSize: 11, fontFamily: FONTS.bold },
  score: { color: '#FFFFFF', fontSize: 26, fontFamily: FONTS.bold },
  kickoff: { color: '#FFFFFF', fontSize: 20, fontFamily: FONTS.bold },
  vs: { color: '#555555', fontSize: 12 },

  // Watch button
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E50914',
    borderRadius: 6,
    paddingVertical: 10,
  },
  watchBtnLoading: { opacity: 0.55 },
  watchTxt: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.bold },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  emptyDesc: {
    color: '#8c8c8c',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  codePath: {
    color: '#E50914',
    fontFamily: FONTS.semiBold,
  },
  hint: { color: '#8c8c8c', fontSize: 13, textAlign: 'center' },
  getKeyBtn: {
    marginTop: 8,
    backgroundColor: '#E50914',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  getKeyTxt: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold },
});
