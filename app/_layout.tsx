import { FONTS, fontAssets } from '@/constants/fonts';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';

const TextAny = Text as any;
if (!TextAny.defaultProps) TextAny.defaultProps = {};
TextAny.defaultProps.style = { fontFamily: FONTS.regular };

const TextInputAny = TextInput as any;
if (!TextInputAny.defaultProps) TextInputAny.defaultProps = {};
TextInputAny.defaultProps.style = { fontFamily: FONTS.regular };

SplashScreen.preventAutoHideAsync();


export default function RootLayout() {
  const [loaded] = useFonts(fontAssets);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="matches" options={{ presentation: 'card' }} />
        <Stack.Screen name="match-stream" options={{ presentation: 'card' }} />
        <Stack.Screen name="article" options={{ presentation: 'card' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
