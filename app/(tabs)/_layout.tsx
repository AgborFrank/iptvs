import { FONTS } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#8c8c8c',
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'home' : 'home-outline') as IoniconsName}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'search' : 'search-outline') as IoniconsName}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sport"
        options={{
          title: 'Sports',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'trophy' : 'trophy-outline') as IoniconsName}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="new-hot"
        options={{
          title: 'News',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'newspaper' : 'newspaper-outline') as IoniconsName}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: 'Music',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={(focused ? 'musical-notes' : 'musical-notes-outline') as IoniconsName}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000000',
    borderTopColor: '#1a1a1a',
    borderTopWidth: 0.5,
  },
  label: {
    fontSize: 10,
    fontFamily: FONTS.regular,
  },
});
