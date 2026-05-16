import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { useScheduleStore, getCurrentBlock, getUpcomingBlocks, getTodayBlocks } from '../../src/store/scheduleStore';
import { useHabitStore } from '../../src/store/habitStore';
import { CurrentBlockBanner } from '../../src/components/CurrentBlockBanner';
import { HabitChip } from '../../src/components/HabitChip';

export default function TodayScreen() {
  const { blocks, load: loadSchedule } = useScheduleStore();
  const { habits, load: loadHabits, isScheduledToday } = useHabitStore();

  useEffect(() => {
    loadSchedule();
    loadHabits();
  }, []);

  const currentBlock = getCurrentBlock(blocks);
  const upcomingBlocks = getUpcomingBlocks(blocks, 3);
  const todayBlocks = getTodayBlocks(blocks);
  const todayHabits = habits.filter(isScheduledToday);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>

        {/* Current Block */}
        {currentBlock && <CurrentBlockBanner block={currentBlock} />}
        {!currentBlock && (
          <View style={styles.freeBlock}>
            <Text style={styles.freeText}>No active block right now</Text>
            <Text style={styles.freeSubtext}>Enjoy your free time</Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todayBlocks.length}</Text>
            <Text style={styles.statLabel}>Blocks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todayHabits.length}</Text>
            <Text style={styles.statLabel}>Habits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {todayHabits.filter((h) => h.completedDates.includes(new Date().toISOString().slice(0, 10))).length}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {/* Habits */}
        {todayHabits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <View style={styles.habitsWrap}>
              {todayHabits.map((h) => (
                <HabitChip key={h.id} habit={h} />
              ))}
            </View>
          </View>
        )}

        {/* Upcoming Blocks */}
        {upcomingBlocks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coming Up</Text>
            {upcomingBlocks.map((b) => (
              <View key={b.id} style={styles.upcomingBlock}>
                <View style={[styles.upcomingDot, { backgroundColor: colors.categories[b.category] }]} />
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingTitle}>{b.title}</Text>
                  <Text style={styles.upcomingTime}>{b.startTime} – {b.endTime}</Text>
                </View>
                <Text style={[styles.upcomingCat, { color: colors.categories[b.category] }]}>
                  {b.category}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  greeting: { color: colors.text, fontSize: 28, fontWeight: '700' },
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  freeBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  freeText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  freeSubtext: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  habitsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  upcomingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  upcomingDot: { width: 10, height: 10, borderRadius: 5 },
  upcomingInfo: { flex: 1 },
  upcomingTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  upcomingTime: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  upcomingCat: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
