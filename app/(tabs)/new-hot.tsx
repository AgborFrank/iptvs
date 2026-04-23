import { FONTS } from '@/constants/fonts';
import { Article, NEWS_CATEGORIES, NewsCategory, fetchNewsCategory, timeAgo } from '@/services/news';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW } = Dimensions.get('window');
const CAROUSEL_W = Math.round(SW * 0.62);
const CAROUSEL_IMG_H = Math.round(CAROUSEL_W * 9 / 16);

// ── Helpers ──────────────────────────────────────────────────────
function openArticle(article: Article) {
  router.push({ pathname: '/article', params: { title: article.title, url: article.url, source: article.source } });
}

type Section =
  | { type: 'hero'; article: Article }
  | { type: 'carousel'; title: string; articles: Article[] }
  | { type: 'compact-list'; title: string; articles: Article[] };

function buildSections(articles: Article[]): Section[] {
  if (articles.length === 0) return [];
  const sections: Section[] = [{ type: 'hero', article: articles[0] }];
  const sourceMap = new Map<string, Article[]>();
  for (const a of articles.slice(1)) {
    if (!sourceMap.has(a.source)) sourceMap.set(a.source, []);
    sourceMap.get(a.source)!.push(a);
  }
  const compact: Article[] = [];
  for (const [source, arts] of sourceMap) {
    if (arts.length >= 3) sections.push({ type: 'carousel', title: `From ${source}`, articles: arts });
    else compact.push(...arts);
  }
  if (compact.length > 0) sections.push({ type: 'compact-list', title: 'More Headlines', articles: compact });
  return sections;
}

// ── Card components ───────────────────────────────────────────────
function HeroCard({ article }: { article: Article }) {
  const [err, setErr] = useState(false);
  return (
    <TouchableOpacity style={styles.hero} onPress={() => openArticle(article)} activeOpacity={0.9}>
      {article.imageUrl && !err
        ? <Image source={{ uri: article.imageUrl }} style={{ position: 'absolute', width: SW, height: 240 }} resizeMode="cover" resizeMethod="scale" fadeDuration={0} onError={() => setErr(true)} />
        : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="newspaper-outline" size={52} color="#1e1e1e" /></View>
      }
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.94)']} style={styles.heroGradient}>
        <View style={styles.heroMeta}>
          <View style={styles.sourcePill}><Text style={styles.sourcePillText}>{article.source}</Text></View>
          <Text style={styles.heroTime}>{timeAgo(article.publishedAt)}</Text>
        </View>
        <Text style={styles.heroTitle} numberOfLines={3}>{article.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function CarouselCard({ article }: { article: Article }) {
  const [err, setErr] = useState(false);
  return (
    <TouchableOpacity style={styles.carouselCard} onPress={() => openArticle(article)} activeOpacity={0.85}>
      {article.imageUrl && !err
        ? <Image source={{ uri: article.imageUrl }} style={styles.carouselImg} resizeMode="cover" resizeMethod="scale" fadeDuration={0} onError={() => setErr(true)} />
        : <View style={[styles.carouselImg, { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="newspaper-outline" size={26} color="#1e1e1e" /></View>
      }
      <View style={styles.carouselBody}>
        <Text style={styles.carouselSource}>{article.source}</Text>
        <Text style={styles.carouselTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.carouselTime}>{timeAgo(article.publishedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CompactCard({ article }: { article: Article }) {
  const [err, setErr] = useState(false);
  return (
    <TouchableOpacity style={styles.compactCard} onPress={() => openArticle(article)} activeOpacity={0.82}>
      <View style={styles.compactBody}>
        <Text style={styles.compactSource}>{article.source}</Text>
        <Text style={styles.compactTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.compactTime}>{timeAgo(article.publishedAt)}</Text>
      </View>
      {article.imageUrl && !err && (
        <Image source={{ uri: article.imageUrl }} style={styles.compactThumb} resizeMode="cover" resizeMethod="scale" fadeDuration={0} onError={() => setErr(true)} />
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SkeletonHero() { return <View style={[styles.hero, { backgroundColor: '#111' }]} />; }
function SkeletonCarousel() {
  return (
    <View style={styles.sectionWrap}>
      <View style={[styles.sectionHeader]}>
        <View style={{ width: 3, height: 16, backgroundColor: '#222', borderRadius: 2 }} />
        <View style={{ width: 120, height: 12, backgroundColor: '#222', borderRadius: 4 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselList} scrollEnabled={false}>
        {[1, 2].map(i => <View key={i} style={[styles.carouselCard, { backgroundColor: '#111' }]} />)}
      </ScrollView>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function NewHotScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<NewsCategory>(NEWS_CATEGORIES[0]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const cache = useRef<Map<string, Article[]>>(new Map());

  const load = useCallback(async (cat: NewsCategory, force = false) => {
    if (!force && cache.current.has(cat.key)) {
      setArticles(cache.current.get(cat.key)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await fetchNewsCategory(cat);
      cache.current.set(cat.key, data);
      setArticles(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeCategory); }, [activeCategory, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(activeCategory, true);
    setRefreshing(false);
  }, [activeCategory, load]);

  const switchCategory = useCallback((cat: NewsCategory) => {
    if (cat.key === activeCategory.key) return;
    setActiveCategory(cat);
    const cached = cache.current.get(cat.key);
    if (cached) { setArticles(cached); setLoading(false); }
    else { setArticles([]); setLoading(true); }
  }, [activeCategory.key]);

  const sections = useMemo(() => buildSections(articles), [articles]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>News</Text>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsContent}>
        {NEWS_CATEGORIES.map((cat) => {
          const active = cat.key === activeCategory.key;
          return (
            <TouchableOpacity key={cat.key} style={[styles.tab, active && styles.tabActive]} onPress={() => switchCategory(cat)} activeOpacity={0.8}>
              <View style={styles.tabInner}>
                <Ionicons name={cat.iconName as any} size={13} color={active ? '#FFFFFF' : '#666'} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{cat.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading && articles.length === 0 ? (
        <ScrollView scrollEnabled={false}>
          <SkeletonHero />
          <SkeletonCarousel />
        </ScrollView>
      ) : error && articles.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color="#2a2a2a" />
          <Text style={styles.centerTitle}>Couldn&apos;t load news</Text>
          <Text style={styles.centerSub}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(activeCategory, true)} activeOpacity={0.8}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E50914" />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {sections.map((section, idx) => {
            if (section.type === 'hero') {
              return <HeroCard key={`hero-${idx}`} article={section.article} />;
            }
            if (section.type === 'carousel') {
              return (
                <View key={`carousel-${idx}`} style={styles.sectionWrap}>
                  <SectionHeader title={section.title} />
                  <FlatList
                    horizontal
                    data={section.articles}
                    keyExtractor={a => a.id}
                    renderItem={({ item }) => <CarouselCard article={item} />}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselList}
                    snapToInterval={CAROUSEL_W + 12}
                    decelerationRate="fast"
                  />
                </View>
              );
            }
            if (section.type === 'compact-list') {
              return (
                <View key={`compact-${idx}`} style={styles.sectionWrap}>
                  <SectionHeader title={section.title} />
                  {section.articles.map(a => <CompactCard key={a.id} article={a} />)}
                </View>
              );
            }
            return null;
          })}
          {articles.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="newspaper-outline" size={48} color="#2a2a2a" />
              <Text style={styles.centerTitle}>No articles found</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontFamily: FONTS.bold },

  tabsRow: { maxHeight: 46, marginBottom: 6 },
  tabsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1c1c1e' },
  tabActive: { backgroundColor: '#E50914' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabText: { color: '#666', fontSize: 13, fontFamily: FONTS.semiBold },
  tabTextActive: { color: '#FFFFFF' },

  // Hero
  hero: { width: SW, height: 240, overflow: 'hidden' },
  heroGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 16 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sourcePill: { backgroundColor: '#E50914', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  sourcePillText: { color: '#fff', fontSize: 10, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.7 },
  heroTime: { color: '#aaa', fontSize: 11, fontFamily: FONTS.regular },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: FONTS.bold, lineHeight: 27 },

  // Section header
  sectionWrap: { marginTop: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  sectionAccent: { width: 3, height: 16, backgroundColor: '#E50914', borderRadius: 2 },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontFamily: FONTS.bold },

  // Carousel
  carouselList: { paddingHorizontal: 16, gap: 12 },
  carouselCard: { width: CAROUSEL_W, backgroundColor: '#111', borderRadius: 8, overflow: 'hidden' },
  carouselImg: { width: CAROUSEL_W, height: CAROUSEL_IMG_H },
  carouselBody: { padding: 10, gap: 4 },
  carouselSource: { color: '#E50914', fontSize: 10, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  carouselTitle: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18 },
  carouselTime: { color: '#555', fontSize: 11, fontFamily: FONTS.regular },

  // Compact list
  compactCard: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a1a' },
  compactBody: { flex: 1, gap: 4 },
  compactSource: { color: '#E50914', fontSize: 10, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  compactTitle: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 18 },
  compactTime: { color: '#555', fontSize: 11, fontFamily: FONTS.regular },
  compactThumb: { width: 80, height: 60, borderRadius: 6 },

  // States
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  centerTitle: { color: '#FFFFFF', fontSize: 17, fontFamily: FONTS.semiBold, marginTop: 18, marginBottom: 6 },
  centerSub: { color: '#666', fontSize: 13, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  retryBtn: { paddingHorizontal: 28, paddingVertical: 11, backgroundColor: '#1c1c1e', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3a3a3a' },
  retryTxt: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.semiBold },
});
