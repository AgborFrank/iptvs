import { FONTS } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function ArticleScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title: string;
    url: string;
    source: string;
  }>();

  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;

  const INJECT_CSS = `
(function() {
  var HIDE = [
    'header','footer','nav','aside',
    '[role="banner"],[role="navigation"],[role="contentinfo"]',
    '.header,.site-header,.page-header,.top-header,.sticky-header,.fixed-header',
    '.footer,.site-footer,.page-footer,.bottom-bar,.sticky-footer',
    '.nav,.navbar,.navigation,.main-nav,.top-nav,.site-nav,.mega-menu',
    '#header,#footer,#nav,#navigation,#menu,#topbar,#top-bar',
    '.cookie-banner,.cookie-notice,.cookie-bar,.gdpr-banner,.consent-banner,.cc-banner,.cc-window',
    '.ad,.ads,.ad-container,.ad-wrapper,.ad-slot,.advertisement,.sponsored,.promo-banner',
    '.social-share,.share-bar,.share-buttons,.social-buttons,.social-links',
    '.newsletter,.newsletter-popup,.email-signup,.subscription-form',
    '#comments,.comments,.comments-section,#disqus_thread',
    '.related-articles,.recommended,.more-stories,.also-read',
    '.modal-backdrop,.overlay,.popup-overlay,.paywall-overlay',
    '.breaking-news-bar,.alert-bar,.notification-bar',
  ].join(',');
  var s = document.createElement('style');
  s.id = '__rdr__';
  s.textContent = HIDE + '{display:none!important;visibility:hidden!important;}' +
    'body{margin-top:0!important;padding-top:0!important;}';
  (document.head||document.documentElement).appendChild(s);
  var obs = new MutationObserver(function(){
    if (!document.getElementById('__rdr__')) {
      var s2 = document.createElement('style');
      s2.id = '__rdr__';
      s2.textContent = HIDE + '{display:none!important;}';
      document.head && document.head.appendChild(s2);
    }
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();
true;
  `.trim();

  const onLoadProgress = ({ nativeEvent }: any) => {
    Animated.timing(progress, {
      toValue: nativeEvent.progress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const onLoadEnd = () => {
    setLoading(false);
    Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start(() => progress.setValue(0));
  };

  const goBack = () => {
    if (canGoBack) webRef.current?.goBack();
    else router.back();
  };

  const onShare = async () => {
    try {
      await Share.share({
        title: params.title,
        url: params.url,
        message: Platform.OS === 'android' ? `${params.title}\n${params.url}` : params.title,
      });
    } catch {}
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={goBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <View style={styles.sourcePill}>
            <Text style={styles.sourceLabel} numberOfLines={1}>{params.source ?? 'Article'}</Text>
          </View>
          <Text style={styles.navTitle} numberOfLines={1}>{params.title}</Text>
        </View>

        <TouchableOpacity style={styles.navBtn} onPress={onShare} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Loading progress bar */}
      {loading && (
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      )}

      {/* Full article WebView */}
      <WebView
        ref={webRef}
        source={{ uri: params.url }}
        style={styles.webview}
        injectedJavaScript={INJECT_CSS}
        onLoadProgress={onLoadProgress}
        onLoadEnd={onLoadEnd}
        onLoadStart={() => setLoading(true)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        contentInsetAdjustmentBehavior="automatic"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1c1c1c',
    gap: 4,
  },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center', gap: 2 },
  sourcePill: {
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sourceLabel: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  navTitle: {
    color: '#AAAAAA',
    fontSize: 11,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },

  progressTrack: {
    height: 2,
    backgroundColor: '#1c1c1c',
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    backgroundColor: '#E50914',
  },

  webview: { flex: 1, backgroundColor: '#fff' },
});
