import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors } from '../../src/theme/colors';
import { useHabitStore, Habit, HabitFrequency } from '../../src/store/habitStore';

const FREQUENCIES: HabitFrequency[] = ['daily', 'weekdays', 'weekends', 'custom'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMOJIS = ['💪', '📖', '🧘', '🥗', '💧', '🏃', '✍️', '🎯', '🌿', '😴', '🚴', '🧠'];

function HabitRow({ habit, onLongPress }: { habit: Habit; onLongPress: () => void }) {
  const { toggleToday, isCompletedToday, isScheduledToday } = useHabitStore();
  const done = isCompletedToday(habit);
  const scheduled = isScheduledToday(habit);

  const handlePress = () => {
    Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    toggleToday(habit.id);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      style={[styles.habitRow, done && styles.habitRowDone, !scheduled && styles.habitRowInactive]}
      activeOpacity={0.7}
    >
      <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
        {done && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.habitEmoji}>{habit.emoji}</Text>
      <View style={styles.habitInfo}>
        <Text style={[styles.habitName, done && styles.habitNameDone]}>{habit.name}</Text>
        <Text style={styles.habitFreq}>{habit.frequency}</Text>
      </View>
      <View style={styles.habitRight}>
        {habit.streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakNum}>{habit.streak}</Text>
          </View>
        )}
        {!scheduled && <Text style={styles.notToday}>Not today</Text>}
      </View>
    </TouchableOpacity>
  );
}

interface FormState {
  name: string;
  emoji: string;
  frequency: HabitFrequency;
  customDays: number[];
}

const emptyForm: FormState = {
  name: '',
  emoji: '💪',
  frequency: 'daily',
  customDays: [],
};

export default function HabitsScreen() {
  const { habits, load, addHabit, deleteHabit } = useHabitStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    addHabit({
      name: form.name.trim(),
      emoji: form.emoji,
      frequency: form.frequency,
      customDays: form.frequency === 'custom' ? form.customDays : undefined,
    });
    setModalVisible(false);
  };

  const handleLongPress = (habit: Habit) => {
    Alert.alert(habit.name, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteHabit(habit.id),
      },
    ]);
  };

  const todayTotal = habits.filter((h) => useHabitStore.getState().isScheduledToday(h)).length;
  const todayDone = habits.filter(
    (h) =>
      useHabitStore.getState().isScheduledToday(h) &&
      useHabitStore.getState().isCompletedToday(h)
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Habits</Text>
          <Text style={styles.subtitle}>{todayDone}/{todayTotal} today</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {habits.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptySubtext}>Add your first habit to start tracking</Text>
          </View>
        )}
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} onLongPress={() => handleLongPress(h)} />
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Habit</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setForm((f) => ({ ...f, emoji: e }))}
                  style={[styles.emojiBtn, form.emoji === e && styles.emojiBtnActive]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="Habit name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Frequency</Text>
            <View style={styles.freqRow}>
              {FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq}
                  onPress={() => setForm((f) => ({ ...f, frequency: freq }))}
                  style={[styles.freqBtn, form.frequency === freq && styles.freqBtnActive]}
                >
                  <Text style={[styles.freqText, form.frequency === freq && styles.freqTextActive]}>
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.frequency === 'custom' && (
              <>
                <Text style={styles.fieldLabel}>Days</Text>
                <View style={styles.daysRow}>
                  {DAY_LABELS.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        const days = form.customDays.includes(i)
                          ? form.customDays.filter((x) => x !== i)
                          : [...form.customDays, i];
                        setForm((f) => ({ ...f, customDays: days }));
                      }}
                      style={[styles.dayBtn, form.customDays.includes(i) && styles.dayBtnActive]}
                    >
                      <Text style={[styles.dayText, form.customDays.includes(i) && styles.dayTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + '60',
    marginTop: 4,
  },
  addBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, marginTop: 6 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  habitRowDone: { borderColor: colors.primary + '40', backgroundColor: colors.primaryFaint },
  habitRowInactive: { opacity: 0.5 },
  habitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.bg, fontSize: 13, fontWeight: '800' },
  habitEmoji: { fontSize: 22 },
  habitInfo: { flex: 1 },
  habitName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  habitNameDone: { color: colors.primary },
  habitFreq: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  habitRight: { alignItems: 'flex-end' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakFire: { fontSize: 14 },
  streakNum: { color: colors.text, fontSize: 14, fontWeight: '700' },
  notToday: { color: colors.textMuted, fontSize: 11 },
  // Modal
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  modalCancel: { color: colors.textSecondary, fontSize: 16 },
  modalSave: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  modalContent: { padding: 20, paddingBottom: 60 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  emojiText: { fontSize: 22 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  freqBtnActive: { backgroundColor: colors.primaryFaint, borderColor: colors.primary },
  freqText: { color: colors.textSecondary, fontSize: 14, textTransform: 'capitalize' },
  freqTextActive: { color: colors.primary },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayBtnActive: { backgroundColor: colors.primaryFaint, borderColor: colors.primary },
  dayText: { color: colors.textSecondary, fontSize: 13 },
  dayTextActive: { color: colors.primary },
});
