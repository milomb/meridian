import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../src/theme/colors';
import { useMoodStore, MoodLevel, MOOD_EMOJI, MOOD_LABEL, MOOD_COLOR } from '../../src/store/moodStore';

const MOOD_LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getLast30Days() {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateStr(d));
  }
  return days;
}

export default function MoodScreen() {
  const c = useColors();
  const { entries, load, saveEntry, deleteEntry, getEntryForDate } = useMoodStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editDate, setEditDate] = useState(toDateStr(new Date()));
  const [selectedMood, setSelectedMood] = useState<MoodLevel>(3);
  const [note, setNote] = useState('');

  useEffect(() => { load(); }, []);

  const today = toDateStr(new Date());
  const todayEntry = getEntryForDate(today);
  const last30 = getLast30Days();

  const openEditor = (date: string) => {
    const existing = getEntryForDate(date);
    setEditDate(date);
    setSelectedMood(existing?.mood ?? 3);
    setNote(existing?.note ?? '');
    setModalVisible(true);
  };

  const handleSave = () => {
    saveEntry(editDate, selectedMood, note.trim());
    setModalVisible(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(id) },
    ]);
  };

  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    title: { color: c.text, fontSize: 28, fontWeight: '600' },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    sectionLabel: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    todayCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 28,
      alignItems: 'center',
    },
    todayLabel: { color: c.textSecondary, fontSize: 13, marginBottom: 12 },
    todayMoodRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    moodBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    moodBtnActive: { borderColor: c.primary, backgroundColor: c.primaryFaint },
    moodEmoji: { fontSize: 26 },
    moodLabel: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
    logBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    logBtnText: { color: c.isDark ? c.bg : '#fff', fontSize: 14, fontWeight: '600' },
    editBtn: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    editBtnText: { color: c.primary, fontSize: 13 },
    todayExisting: { alignItems: 'center', gap: 8 },
    todayExistingEmoji: { fontSize: 44 },
    todayExistingLabel: { color: c.text, fontSize: 18, fontWeight: '500' },
    todayExistingNote: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
    todayBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 28 },
    calDay: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
    },
    calDayText: { fontSize: 12, fontWeight: '400' },
    entryCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    entryEmoji: { fontSize: 28 },
    entryContent: { flex: 1 },
    entryDate: { color: c.textSecondary, fontSize: 12, marginBottom: 2 },
    entryMoodLabel: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
    entryNote: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
    entryDelete: { color: c.textMuted, fontSize: 20, padding: 4 },
    modal: { flex: 1, backgroundColor: c.bg },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: { color: c.text, fontSize: 17, fontWeight: '600' },
    modalCancel: { color: c.textSecondary, fontSize: 16 },
    modalSave: { color: c.primary, fontSize: 16, fontWeight: '600' },
    modalContent: { padding: 20, paddingBottom: 60 },
    fieldLabel: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    moodPickerRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
    moodPickerBtn: {
      alignItems: 'center',
      gap: 4,
      padding: 10,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: c.surfaceAlt,
    },
    moodPickerBtnActive: { borderColor: c.primary, backgroundColor: c.primaryFaint },
    moodPickerEmoji: { fontSize: 30 },
    moodPickerLabel: { fontSize: 11, color: c.textSecondary },
    noteInput: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      color: c.text,
      fontSize: 15,
      fontWeight: '400',
      minHeight: 120,
      textAlignVertical: 'top',
      marginTop: 16,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
      >
        <Ionicons name="chevron-back" size={20} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: '400' }}>Back</Text>
      </TouchableOpacity>
      <View style={s.header}>
        <Text style={s.title}>Mood</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Today */}
        <View style={s.todayCard}>
          {todayEntry ? (
            <View style={s.todayExisting}>
              <Text style={s.todayExistingEmoji}>{MOOD_EMOJI[todayEntry.mood]}</Text>
              <Text style={[s.todayExistingLabel, { color: MOOD_COLOR[todayEntry.mood] }]}>
                {MOOD_LABEL[todayEntry.mood]} today
              </Text>
              {todayEntry.note ? (
                <Text style={s.todayExistingNote}>{todayEntry.note}</Text>
              ) : null}
              <View style={s.todayBtns}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEditor(today)}>
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.editBtn} onPress={() => confirmDelete(todayEntry.id)}>
                  <Text style={[s.editBtnText, { color: c.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.todayLabel}>How are you feeling today?</Text>
              <View style={s.todayMoodRow}>
                {MOOD_LEVELS.map((lvl) => (
                  <TouchableOpacity key={lvl} style={s.moodBtn} onPress={() => openEditor(today)}>
                    <Text style={s.moodEmoji}>{MOOD_EMOJI[lvl]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.logBtn} onPress={() => openEditor(today)}>
                <Text style={s.logBtnText}>Log today's mood</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 30-day grid */}
        <Text style={s.sectionLabel}>Last 30 Days</Text>
        <View style={s.calGrid}>
          {last30.map((date) => {
            const entry = getEntryForDate(date);
            const isToday = date === today;
            const bgColor = entry ? MOOD_COLOR[entry.mood] + '50' : c.surfaceAlt;
            const dotColor = entry ? MOOD_COLOR[entry.mood] : 'transparent';
            const dayNum = parseInt(date.slice(8));
            return (
              <TouchableOpacity
                key={date}
                style={[
                  s.calDay,
                  { backgroundColor: bgColor },
                  isToday && { borderWidth: 2, borderColor: c.primary },
                ]}
                onPress={() => openEditor(date)}
              >
                {entry ? (
                  <Text style={{ fontSize: 18 }}>{MOOD_EMOJI[entry.mood]}</Text>
                ) : (
                  <Text style={[s.calDayText, { color: isToday ? c.primary : c.textMuted }]}>
                    {dayNum}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Entry list */}
        {recent.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Recent Entries</Text>
            {recent.map((entry) => (
              <View key={entry.id} style={s.entryCard}>
                <Text style={s.entryEmoji}>{MOOD_EMOJI[entry.mood]}</Text>
                <View style={s.entryContent}>
                  <Text style={s.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'short', day: 'numeric',
                    })}
                  </Text>
                  <Text style={[s.entryMoodLabel, { color: MOOD_COLOR[entry.mood] }]}>
                    {MOOD_LABEL[entry.mood]}
                  </Text>
                  {entry.note ? <Text style={s.entryNote}>{entry.note}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => confirmDelete(entry.id)}>
                  <Text style={s.entryDelete}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Editor Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>
                {new Date(editDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={s.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalContent}>
              <Text style={s.fieldLabel}>How are you feeling?</Text>
              <View style={s.moodPickerRow}>
                {MOOD_LEVELS.map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[s.moodPickerBtn, selectedMood === lvl && s.moodPickerBtnActive]}
                    onPress={() => setSelectedMood(lvl)}
                  >
                    <Text style={s.moodPickerEmoji}>{MOOD_EMOJI[lvl]}</Text>
                    <Text style={[s.moodPickerLabel, selectedMood === lvl && { color: c.primary }]}>
                      {MOOD_LABEL[lvl]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={s.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Write about your day… (optional)"
                placeholderTextColor={c.textMuted}
                multiline
                autoFocus={false}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
