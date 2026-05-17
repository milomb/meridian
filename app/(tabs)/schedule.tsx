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
import { useColors, getCategoryColor, getCategoryBg } from '../../src/theme/colors';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useScheduleStore, TimeBlock, DayOfWeek } from '../../src/store/scheduleStore';

const BUILT_IN_CATEGORIES = ['work', 'training', 'personal', 'rest', 'nutrition', 'learning'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BlockFormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
  daysOfWeek: DayOfWeek[];
  isFixed: boolean;
  reminder: boolean;
}

const emptyForm: BlockFormState = {
  title: '',
  description: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'work',
  daysOfWeek: [1, 2, 3, 4, 5],
  isFixed: false,
  reminder: false,
};

export default function ScheduleScreen() {
  const c = useColors();
  const { blocks, load, addBlock, updateBlock, deleteBlock } = useScheduleStore();
  const { customCategories } = useSettingsStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockFormState>(emptyForm);
  const [view, setView] = useState<'list' | 'week'>('list');

  const allCategories = [
    ...BUILT_IN_CATEGORIES,
    ...customCategories.map((c) => c.name),
  ];

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEdit = (block: TimeBlock) => {
    setForm({
      title: block.title,
      description: block.description ?? '',
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

  // Week view: group blocks by day
  const weekDays = Array.from({ length: 7 }, (_, i) => ({
    day: i as DayOfWeek,
    label: DAY_FULL[i],
    blocks: sorted.filter((b) => b.daysOfWeek.includes(i as DayOfWeek)),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '600' }}>Schedule</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* View toggle */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: c.surfaceAlt,
            borderRadius: 10,
            padding: 2,
            borderWidth: 1,
            borderColor: c.border,
          }}>
            {(['list', 'week'] as const).map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setView(v)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: view === v ? c.primary : 'transparent',
                }}
              >
                <Text style={{
                  color: view === v ? (c.isDark ? c.bg : '#fff') : c.textSecondary,
                  fontSize: 12,
                  fontWeight: '500',
                  textTransform: 'capitalize',
                }}>
                  {v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={openAdd}
            style={{
              backgroundColor: c.primaryFaint,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: c.primary + '60',
            }}
          >
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {view === 'list' ? (
          sorted.map((b) => {
            const catColor = getCategoryColor(b.category, customCategories, c);
            const catBg = getCategoryBg(b.category, customCategories, c);
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => openEdit(b)}
                style={{
                  backgroundColor: c.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderLeftWidth: 3,
                  borderLeftColor: catColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{b.title}</Text>
                    <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2, fontWeight: '400' }}>
                      {b.startTime} – {b.endTime}
                    </Text>
                    {b.description ? (
                      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4, fontWeight: '400' }} numberOfLines={2}>
                        {b.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: catColor, textTransform: 'capitalize', marginLeft: 8 }}>
                    {b.category}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {DAY_LABELS.map((d, i) => (
                      <View
                        key={i}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: b.daysOfWeek.includes(i as DayOfWeek) ? catColor : c.surfaceAlt,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{
                          color: b.daysOfWeek.includes(i as DayOfWeek) ? (c.isDark ? c.bg : '#fff') : c.textMuted,
                          fontSize: 9,
                          fontWeight: '600',
                        }}>
                          {d}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {b.isFixed && (
                      <View style={{
                        backgroundColor: c.surfaceAlt,
                        borderRadius: 5,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}>
                        <Text style={{ color: c.textSecondary, fontSize: 10 }}>Fixed</Text>
                      </View>
                    )}
                    {b.reminder && (
                      <Text style={{ fontSize: 12 }}>🔔</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          weekDays.map(({ day, label, blocks: dayBlocks }) => (
            <View key={day} style={{ marginBottom: 20 }}>
              <Text style={{
                color: day === new Date().getDay() ? c.primary : c.textSecondary,
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                {label}
                {day === new Date().getDay() ? ' · Today' : ''}
              </Text>
              {dayBlocks.length === 0 ? (
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '400' }}>No blocks</Text>
              ) : (
                dayBlocks.map((b) => {
                  const catColor = getCategoryColor(b.category, customCategories, c);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      onPress={() => openEdit(b)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: c.surface,
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: catColor }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{b.title}</Text>
                        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '400' }}>
                          {b.startTime} – {b.endTime}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Block editor modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            paddingTop: 60,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>
              {editingId ? 'Edit Block' : 'New Block'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <FieldLabel text="Title" c={c} />
            <TextInput
              style={inputStyle(c)}
              value={form.title}
              onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
              placeholder="Block title"
              placeholderTextColor={c.textMuted}
            />

            <FieldLabel text="Description" c={c} />
            <TextInput
              style={[inputStyle(c), { minHeight: 70, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              placeholder="Optional notes about this block"
              placeholderTextColor={c.textMuted}
              multiline
            />

            <View style={{ flexDirection: 'row', marginTop: 0 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Start" c={c} />
                <TextInput
                  style={inputStyle(c)}
                  value={form.startTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))}
                  placeholder="09:00"
                  placeholderTextColor={c.textMuted}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel text="End" c={c} />
                <TextInput
                  style={inputStyle(c)}
                  value={form.endTime}
                  onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))}
                  placeholder="10:00"
                  placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            <FieldLabel text="Category" c={c} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {allCategories.map((cat) => {
                const catColor = getCategoryColor(cat, customCategories, c);
                const catBg = getCategoryBg(cat, customCategories, c);
                const active = form.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setForm((f) => ({ ...f, category: cat }))}
                    style={{
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: active ? catColor : c.border,
                      backgroundColor: active ? catBg : c.surface,
                    }}
                  >
                    <Text style={{ color: active ? catColor : c.textSecondary, fontSize: 13, textTransform: 'capitalize', fontWeight: '400' }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel text="Days" c={c} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAY_LABELS.map((d, i) => {
                const active = form.daysOfWeek.includes(i as DayOfWeek);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleDay(i as DayOfWeek)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: active ? c.primary : c.surface,
                      borderWidth: 1,
                      borderColor: active ? c.primary : c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{
                      color: active ? (c.isDark ? c.bg : '#fff') : c.textSecondary,
                      fontSize: 12,
                      fontWeight: '500',
                    }}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginTop: 20, gap: 10 }}>
              <SwitchRow label="Fixed block" value={form.isFixed} onChange={(v) => setForm((f) => ({ ...f, isFixed: v }))} c={c} />
              <SwitchRow label="Reminder" value={form.reminder} onChange={(v) => setForm((f) => ({ ...f, reminder: v }))} c={c} />
            </View>

            {editingId && (
              <TouchableOpacity
                onPress={() => { setModalVisible(false); handleDelete(editingId); }}
                style={{
                  marginTop: 32,
                  backgroundColor: c.isDark ? '#3A1A1A' : '#FFF0F0',
                  borderRadius: 10,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: c.error + '40',
                }}
              >
                <Text style={{ color: c.error, fontSize: 15, fontWeight: '500' }}>Delete Block</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldLabel({ text, c }: { text: string; c: any }) {
  return (
    <Text style={{
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
      marginTop: 20,
    }}>
      {text}
    </Text>
  );
}

function SwitchRow({ label, value, onChange, c }: { label: string; value: boolean; onChange: (v: boolean) => void; c: any }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '400' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.border }}
        thumbColor={c.text}
      />
    </View>
  );
}

function inputStyle(c: any) {
  return {
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    color: c.text,
    fontSize: 15,
    fontWeight: '400' as const,
  };
}
