import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Category } from '../../src/theme/colors';
import { useScheduleStore, TimeBlock, DayOfWeek } from '../../src/store/scheduleStore';

const CATEGORIES: Category[] = ['work', 'training', 'personal', 'rest', 'nutrition', 'learning'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function TimeBlockCard({
  block,
  onEdit,
  onDelete,
}: {
  block: TimeBlock;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catColor = colors.categories[block.category];
  return (
    <TouchableOpacity onPress={onEdit} style={[styles.card, { borderLeftColor: catColor }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{block.title}</Text>
          <Text style={styles.cardTime}>{block.startTime} – {block.endTime}</Text>
        </View>
        <Text style={[styles.cardCat, { color: catColor }]}>{block.category}</Text>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.daysRow}>
          {DAY_LABELS.map((d, i) => (
            <View
              key={i}
              style={[
                styles.dayDot,
                block.daysOfWeek.includes(i as DayOfWeek) && {
                  backgroundColor: catColor,
                },
              ]}
            >
              <Text style={[styles.dayLabel, block.daysOfWeek.includes(i as DayOfWeek) && styles.dayLabelActive]}>
                {d}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.cardTags}>
          {block.isFixed && <View style={styles.tag}><Text style={styles.tagText}>Fixed</Text></View>}
          {block.reminder && <View style={styles.tag}><Text style={styles.tagText}>🔔</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface BlockFormState {
  title: string;
  startTime: string;
  endTime: string;
  category: Category;
  daysOfWeek: DayOfWeek[];
  isFixed: boolean;
  reminder: boolean;
}

const emptyForm: BlockFormState = {
  title: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'work',
  daysOfWeek: [1, 2, 3, 4, 5],
  isFixed: false,
  reminder: false,
};

export default function ScheduleScreen() {
  const { blocks, load, addBlock, updateBlock, deleteBlock } = useScheduleStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockFormState>(emptyForm);

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEdit = (block: TimeBlock) => {
    setForm({
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime,
      category: block.category,
      daysOfWeek: block.daysOfWeek,
      isFixed: block.isFixed,
      reminder: block.reminder,
    });
    setEditingId(block.id);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingId) {
      updateBlock(editingId, form);
    } else {
      addBlock(form);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Block', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBlock(id) },
    ]);
  };

  const toggleDay = (day: DayOfWeek) => {
    const days = form.daysOfWeek.includes(day)
      ? form.daysOfWeek.filter((d) => d !== day)
      : [...form.daysOfWeek, day];
    setForm((f) => ({ ...f, daysOfWeek: days }));
  };

  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sorted.map((b) => (
          <TimeBlockCard
            key={b.id}
            block={b}
            onEdit={() => openEdit(b)}
            onDelete={() => handleDelete(b.id)}
          />
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Block' : 'New Block'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              placeholder="Block title"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start</Text>
                <TextInput
                  style={styles.input}
                  value={form.startTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
                  placeholder="09:00"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End</Text>
                <TextInput
                  style={styles.input}
                  value={form.endTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
                  placeholder="10:00"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setForm((f) => ({ ...f, category: cat }))}
                  style={[
                    styles.categoryChip,
                    form.category === cat && {
                      backgroundColor: colors.categoryBg[cat],
                      borderColor: colors.categories[cat],
                    },
                  ]}
                >
                  <Text style={[styles.categoryChipText, form.category === cat && { color: colors.categories[cat] }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Days</Text>
            <View style={styles.daysRow}>
              {DAY_LABELS.map((d, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleDay(i as DayOfWeek)}
                  style={[
                    styles.dayBtn,
                    form.daysOfWeek.includes(i as DayOfWeek) && styles.dayBtnActive,
                  ]}
                >
                  <Text style={[styles.dayBtnText, form.daysOfWeek.includes(i as DayOfWeek) && styles.dayBtnTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Fixed block</Text>
              <Switch
                value={form.isFixed}
                onValueChange={(v) => setForm((f) => ({ ...f, isFixed: v }))}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Reminder</Text>
              <Switch
                value={form.reminder}
                onValueChange={(v) => setForm((f) => ({ ...f, reminder: v }))}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>

            {editingId && (
              <TouchableOpacity onPress={() => { setModalVisible(false); handleDelete(editingId); }} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete Block</Text>
              </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + '60',
  },
  addBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardTime: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  cardCat: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginLeft: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  daysRow: { flexDirection: 'row', gap: 4 },
  dayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  dayLabelActive: { color: colors.bg },
  cardTags: { flexDirection: 'row', gap: 4 },
  tag: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { color: colors.textSecondary, fontSize: 11 },
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
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 60 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
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
  row: { flexDirection: 'row' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipText: { color: colors.textSecondary, fontSize: 14, textTransform: 'capitalize' },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayBtnTextActive: { color: colors.bg },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabel: { color: colors.text, fontSize: 16 },
  deleteBtn: {
    marginTop: 32,
    backgroundColor: '#3A1A1A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  deleteBtnText: { color: colors.error, fontSize: 16, fontWeight: '600' },
});
