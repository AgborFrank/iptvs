import { FONTS } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

// Build the iframe HTML — no sandbox attribute per SportSRC docs
function buildHtml(streamUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  iframe { width: 100%; height: 100%; border: none; display: block; }
</style>
</head>
<body>
<iframe
  src="${streamUrl}"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
  allowfullscreen
  scrolling="no"
></iframe>
</body>
</html>`;
}

export default function MatchStreamScreen() {
  const insets = useSafeAreaInsets();
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title ?? 'Live Match'}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backBtn}
          onPress={() => webViewRef.current?.reload()}
        >
          <Ionicons name="reload-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* WebView */}
      {url ? (
        <View style={styles.playerContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: buildHtml(url) }}
            style={styles.webview}
            javaScriptEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            startInLoadingState={false}
            onLoadStart={() => { setLoading(true); setError(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          />
          {loading && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#E50914" />
              <Text style={styles.hint}>Loading stream…</Text>
            </View>
          )}
          {error && !loading && (
            <View style={styles.overlay}>
              <Ionicons name="warning-outline" size={48} color="#E50914" />
              <Text style={styles.errorTitle}>Stream failed to load</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                activeOpacity={0.8}
                onPress={() => { setError(false); webViewRef.current?.reload(); }}
              >
                <Ionicons name="reload" size={16} color="#FFFFFF" />
                <Text style={styles.retryTxt}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={48} color="#555" />
          <Text style={styles.errorTitle}>No stream URL provided</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },

  playerContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1, backgroundColor: '#000000' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hint: { color: '#8c8c8c', fontSize: 13 },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E50914',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  retryTxt: { color: '#FFFFFF', fontSize: 14, fontFamily: FONTS.bold },
});
