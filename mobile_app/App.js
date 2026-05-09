/**
 * App.js — MemoAI v2 Root
 * Tab navigator: Chat | Memories | People | Add Memory | Settings
 * Stack navigator: Settings → CaregiverDashboard
 */
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChatScreen         from './src/screens/ChatScreen';
import MemoryScreen       from './src/screens/MemoryScreen';
import PeopleScreen       from './src/screens/PeopleScreen';
import AddMemoryScreen    from './src/screens/AddMemoryScreen';
import SettingsScreen     from './src/screens/SettingsScreen';
import CaregiverDashboard from './src/screens/CaregiverDashboard';

import { loadSettings }  from './src/utils/settings';
import useTranslation    from './src/utils/useTranslation';
import { colors, fonts } from './src/utils/theme';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Chat:      '💬',
  Memories:  '🌸',
  People:    '👥',
  AddMemory: '✏️',
  Settings:  '⚙️',
};

function TabIcon({ name, focused }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICONS[name] || '●'}
    </Text>
  );
}

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          height: 62,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11 },
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.text,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18 },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Chat"      component={ChatScreen}      options={{ title: t('tabChat'),     tabBarLabel: t('tabChat')     }} />
      <Tab.Screen name="Memories"  component={MemoryScreen}    options={{ title: t('tabMemories'), tabBarLabel: t('tabMemories') }} />
      <Tab.Screen name="People"    component={PeopleScreen}    options={{ title: t('tabPeople'),   tabBarLabel: t('tabPeople')   }} />
      <Tab.Screen name="AddMemory" component={AddMemoryScreen} options={{ title: t('tabAdd'),      tabBarLabel: t('tabAdd')      }} />
      <Tab.Screen name="Settings"  component={SettingsScreen}  options={{ title: t('tabSettings'), tabBarLabel: t('tabSettings') }} />
    </Tab.Navigator>
  );
}

function RootStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.accent,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Main"      component={MainTabs}          options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={CaregiverDashboard} options={{ title: t('dashTitle') }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashIcon}>🧠</Text>
        <Text style={styles.splashTitle}>MemoAI</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash:      { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  splashIcon:  { fontSize: 64, marginBottom: 8 },
  splashTitle: { fontFamily: fonts.bold, fontSize: 32, color: colors.accent },
});
