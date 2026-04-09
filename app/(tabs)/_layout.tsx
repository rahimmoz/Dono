import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { 
          backgroundColor: '#000', 
          borderTopColor: '#222',
          // 🚨 Dynamic height: 60px base + the height of the Samsung nav bar
          height: Platform.OS === 'ios' ? 85 : 60 + insets.bottom,
          // 🚨 Push icons up so they aren't touching the system buttons
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
        tabBarActiveTintColor: '#00FF00',
        tabBarInactiveTintColor: '#888',
        headerShown: false, 
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🏠</Text>,
        }}
      />

      {/* Hidden Screens */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />

      {/* Centered Upload */}
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.uploadButton, { marginBottom: insets.bottom > 0 ? 0 : 5 }]}>
              <Text style={styles.uploadIcon}>+</Text>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    backgroundColor: '#fff',
    width: 45,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#00f2ea',
    borderRightWidth: 3,
    borderRightColor: '#ff0050',
  },
  uploadIcon: {
    color: '#000',
    fontSize: 22,
    fontWeight: 'bold',
  },
});