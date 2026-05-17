import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/theme/colors';

export default function EmailScreen() {
  const c = useColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '600' }}>Inbox</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            backgroundColor: c.primaryFaint,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: c.primary + '60',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="logo-google" size={14} color={c.primary} />
          <Text style={{ color: c.primary, fontSize: 14, fontWeight: '500' }}>Connect Gmail</Text>
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 48 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 22,
          backgroundColor: c.surface,
          borderWidth: 1, borderColor: c.border,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="mail-outline" size={32} color={c.textMuted} />
        </View>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>
          No inbox connected
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
          Connect your inbox to see AI-summarised emails and action items here
        </Text>
      </View>
    </SafeAreaView>
  );
}
