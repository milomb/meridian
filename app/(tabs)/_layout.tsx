import { useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface BrowseItem {
  label: string;
  icon: IoniconName;
  route: string;
  color: string;
}

function BrowseTabButton() {
  const c = useColors();
  const [visible, setVisible] = useState(false);

  const ITEMS: BrowseItem[] = [
    { label: 'Calendar', icon: 'calendar-outline', route: '/(tabs)/calendar', color: '#5B8FD4' },
    { label: 'Settings', icon: 'settings-outline', route: '/(tabs)/settings', color: c.textSecondary },
  ];

  const navigate = (route: string) => {
    setVisible(false);
    router.push(route as any);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8, gap: 3 }}
        activeOpacity={0.7}
      >
        <Ionicons name="apps-outline" size={22} color={c.textMuted} />
        <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: '500', letterSpacing: 0.2 }}>Browse</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setVisible(false)} />

        <View style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 48,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}>
          {/* Handle */}
          <View style={{
            width: 36, height: 4, backgroundColor: c.border,
            borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20,
          }} />

          {/* Grid */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            gap: 12,
          }}>
            {ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => navigate(item.route)}
                style={{
                  width: '30%',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: c.bg,
                  borderRadius: 16,
                  paddingVertical: 20,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 48, height: 48, borderRadius: 14,
                  backgroundColor: item.color + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '500' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function TabLayout() {
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '500', letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Today',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          tabBarLabel: 'Performance',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ tabBarButton: () => <BrowseTabButton /> }}
      />

      {/* Hidden — accessible via Browse. display:'none' removes them from flex layout */}
      <Tabs.Screen name="calendar" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="settings" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
