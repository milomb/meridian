import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { useColors, getCategoryColor, getCategoryBg } from '../../src/theme/colors';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useScheduleStore, TimeBlock, DayOfWeek } from '../../src/store/scheduleStore';
import { useLocalEventStore } from '../../src/store/localEventStore';
import { useResolutionStore } from '../../src/store/resolutionStore';
import { useBlockOverrideStore } from '../../src/store/blockOverrideStore';
import { DayTimeline, CalEvent } from '../../src/components/DayTimeline';

const BUILT_IN_CATEGORIES = ['work', 'training', 'personal', 'rest', 'nutrition', 'learning'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface BlockFormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
  daysOfWeek: DayOfWeek[];
  isFixed: boolean;
  reminder: boolean;
  weight: number;
}

const emptyForm: BlockFormState = {
  title: '', description: '', startTime: '09:00', endTime: '10:00',
  category: 'work', daysOfWeek: [1, 2, 3, 4, 5], isFixed: false, reminder: false, weight: 2,
};

function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ScheduleScreen() {
  const c = useColors();
  const { blocks, load, addBlock, updateBlock, deleteBlock } = useScheduleStore();
  const { customCategories } = useSettingsStore();
  const { events: localEvents, load: loadLocalEvents } = useLocalEventStore();
  const { load: loadResolutions, pendingBlockId, pendingDate, clearPending, getResolution } = useResolutionStore();
  const { load: loadOverrides, getOverride } = useBlockOverrideStore();
  const todayKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const todayDow = new Date().getDay() as DayOfWeek;
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockFormState>(emptyForm);
  const [view, setView] = useState<'list' | 'day'>('day');
  const [selectedDay, setSelectedDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [dayCalEvents, setDayCalEvents] = useState<CalEvent[]>([]);
  const [calGranted, setCalGranted] = useState(false);

  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories.map((cc) => cc.name)];

  useEffect(() => { load(); loadLocalEvents(); loadResolutions(); loadOverrides(); }, []);

  // Deep-link from unresolved banner: navigate to the target day and auto-open the sheet
  useEffect(() => {
    if (!pendingBlockId || !pendingDate) return;
    const [yr, mo, dy] = pendingDate.split('-').map(Number);
    setSelectedDay(new Date(yr, mo - 1, dy));
    setView('day');
    // Don't clearPending here — DayTimeline clears it after opening the sheet
  }, [pendingBlockId, pendingDate]);

  useEffect(() => {
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      if (status === 'granted') setCalGranted(true);
    });
  }, []);

  useEffect(() => {
    if (!calGranted) return;
    fetchDayEvents(selectedDay);
  }, [calGranted, selectedDay]);

  const fetchDayEvents = async (day: Date) => {
    try {
      const start = new Date(day); start.setHours(0, 0, 0, 0);
      const end = new Date(day); end.setHours(23, 59, 59, 999);
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const colorMap = Object.fromEntries(cals.map((cal) => [cal.id, cal.color]));
      const events = await Calendar.getEventsAsync(cals.map((cal) => cal.id), start, end);
      const calEvts: CalEvent[] = events.map((e) => ({
        id: e.id, title: e.title,
        startDate: new Date(e.startDate), endDate: new Date(e.endDate),
        color: colorMap[e.calendarId], isAllDay: e.allDay,
      }));
      const dateKey = fmtDateKey(day);
      const localEvts: CalEvent[] = localEvents
        .filter((e) => e.date === dateKey)
        .map((e) => {
          if (e.isAllDay) return { id: e.id, title: e.title, startDate: start, endDate: end, color: e.color, isLocal: true, isAllDay: true };
          const [sh, sm] = e.startTime.split(':').map(Number);
          const [eh, em] = e.endTime.split(':').map(Number);
          const s = new Date(day); s.setHours(sh, sm, 0, 0);
          const ev = new Date(day); ev.setHours(eh, em, 0, 0);
          return { id: e.id, title: e.title, startDate: s, endDate: ev, color: e.color, isLocal: true };
        });
      setDayCalEvents([...calEvts, ...localEvts]);
    } catch { setDayCalEvents([]); }
  };

  const requestCalPermission = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') setCalGranted(true);
  };

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setModalVisible(true); };
  const openEdit = (block: TimeBlock) => {
    setForm({
      title: block.title, description: block.description ?? '',
      startTime: block.startTime, endTime: block.endTime,
      category: block.category, daysOfWeek: block.daysOfWeek,
      isFixed: block.isFixed, reminder: block.reminder, weight: block.weight ?? 2,
    });
    setEditingId(block.id);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingId) updateBlock(editingId, form); else addBlock(form);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '600' }}>Schedule</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 2, borderWidth: 1, borderColor: c.border }}>
            {(['day', 'list'] as const).map((v) => (
              <TouchableOpacity key={v} onPress={() => setView(v)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: view === v ? c.primary : 'transparent' }}>
                <Text style={{ color: view === v ? (c.isDark ? c.bg : '#fff') : c.textSecondary, fontSize: 11, fontWeight: '500', textTransform: 'capitalize' }}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={openAdd} style={{ backgroundColor: c.primaryFaint, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: c.primary + '60' }}>
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {view === 'day' ? (
        calGranted ? (
          <DayTimeline
            day={selectedDay}
            scheduleBlocks={blocks}
            calEvents={dayCalEvents}
            c={c}
            customCategories={customCategories}
            onDayChange={(d) => setSelectedDay(d)}
            pendingOpenBlockId={pendingBlockId}
            pendingOpenDate={pendingDate}
            onPendingClear={clearPending}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
            <Ionicons name="calendar-outline" size={40} color={c.textMuted} />
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>Calendar access needed</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              The day timeline shows your Apple Calendar events alongside your schedule blocks.
            </Text>
            <TouchableOpacity onPress={requestCalPermission} style={{ backgroundColor: c.primaryFaint, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: c.primary + '60' }}>
              <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>Allow Calendar Access</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {sorted.map((b) => {
            const catColor = getCategoryColor(b.category, customCategories, c);
            const isToday = b.daysOfWeek.includes(todayDow);
            const todayRes = isToday ? getResolution(b.id, todayKey) : null;
            const todayOv = isToday ? getOverride(b.id, todayKey) : null;
            const isDone = todayRes?.status === 'done';
            const isSkipped = todayRes?.status === 'skipped';
            const isMoved = !!todayOv;
            return (
              <TouchableOpacity key={b.id} onPress={() => openEdit(b)} style={{ backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: isDone ? '#3EB87A30' : c.border, borderLeftWidth: 3, borderLeftColor: isDone ? '#3EB87A' : isSkipped ? '#888' : catColor, opacity: isSkipped ? 0.6 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDone ? '#3EB87A' : c.text, fontSize: 15, fontWeight: '500', textDecorationLine: isSkipped ? 'line-through' : 'none' }}>{b.title}</Text>
                    <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2, fontStyle: isMoved ? 'italic' : 'normal' }}>
                      {isMoved ? `${todayOv!.overrideStart} – ${todayOv!.overrideEnd} · moved` : `${b.startTime} – ${b.endTime}`}
                    </Text>
                    {b.description ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{b.description}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {isToday && isDone && <Ionicons name="checkmark-circle" size={16} color="#3EB87A" />}
                    {isToday && isSkipped && <Ionicons name="close-circle" size={16} color="#888" />}
                    {isToday && isMoved && !isDone && !isSkipped && <Ionicons name="time-outline" size={14} color="#D4A574" />}
                    <Text style={{ fontSize: 11, fontWeight: '500', color: catColor, textTransform: 'capitalize' }}>{b.category}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 10 }}>w{b.weight ?? 2}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {DAY_LABELS.map((d, i) => (
                      <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: b.daysOfWeek.includes(i as DayOfWeek) ? catColor : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: b.daysOfWeek.includes(i as DayOfWeek) ? (c.isDark ? c.bg : '#fff') : c.textMuted, fontSize: 9, fontWeight: '600' }}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    {b.isFixed
                      ? <View style={{ backgroundColor: c.primaryFaint, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.primary + '50' }}><Text style={{ color: c.primary, fontSize: 10, fontWeight: '500' }}>Recurring</Text></View>
                      : <View style={{ backgroundColor: '#D4A57418', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#D4A57450' }}><Text style={{ color: '#D4A574', fontSize: 10, fontWeight: '500' }}>Temporary</Text></View>
                    }
                    {b.reminder && <Text style={{ fontSize: 12 }}>🔔</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Block editor modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{editingId ? 'Edit Block' : 'New Block'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <FieldLabel text="Title" c={c} />
            <TextInput style={inputStyle(c)} value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} placeholder="Block title" placeholderTextColor={c.textMuted} />

            <FieldLabel text="Description" c={c} />
            <TextInput style={[inputStyle(c), { minHeight: 70, textAlignVertical: 'top' }]} value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} placeholder="Optional notes" placeholderTextColor={c.textMuted} multiline />

            <View style={{ flexDirection: 'row', marginTop: 0 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel text="Start" c={c} />
                <TextInput style={inputStyle(c)} value={form.startTime} onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))} placeholder="09:00" placeholderTextColor={c.textMuted} />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <FieldLabel text="End" c={c} />
                <TextInput style={inputStyle(c)} value={form.endTime} onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))} placeholder="10:00" placeholderTextColor={c.textMuted} />
              </View>
            </View>

            <FieldLabel text="Category" c={c} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {allCategories.map((cat) => {
                const catColor = getCategoryColor(cat, customCategories, c);
                const catBg = getCategoryBg(cat, customCategories, c);
                const active = form.category === cat;
                return (
                  <TouchableOpacity key={cat} onPress={() => setForm((f) => ({ ...f, category: cat }))} style={{ borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: active ? catColor : c.border, backgroundColor: active ? catBg : c.surface }}>
                    <Text style={{ color: active ? catColor : c.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel text="Schedule Type" c={c} />
            <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: c.border, marginBottom: 4 }}>
              {([
                { value: true, label: 'Recurring', icon: '↻', hint: 'Repeats every week' },
                { value: false, label: 'Temporary', icon: '◈', hint: 'One-off or short-term' },
              ] as const).map((opt) => {
                const active = form.isFixed === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    onPress={() => setForm((f) => ({ ...f, isFixed: opt.value }))}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: active ? c.primary : 'transparent', gap: 1 }}
                  >
                    <Text style={{ color: active ? (c.isDark ? c.bg : '#fff') : c.textSecondary, fontSize: 14, fontWeight: '600' }}>{opt.label}</Text>
                    <Text style={{ color: active ? (c.isDark ? c.bg + 'cc' : '#ffffffcc') : c.textMuted, fontSize: 10 }}>{opt.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel text={form.isFixed ? 'Days (every week)' : 'Days (this occurrence)'} c={c} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAY_LABELS.map((d, i) => {
                const active = form.daysOfWeek.includes(i as DayOfWeek);
                return (
                  <TouchableOpacity key={i} onPress={() => toggleDay(i as DayOfWeek)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: active ? c.primary : c.surface, borderWidth: 1, borderColor: active ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: active ? (c.isDark ? c.bg : '#fff') : c.textSecondary, fontSize: 12, fontWeight: '500' }}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!form.isFixed && (
              <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
                Temporary blocks appear on selected days each week until you delete them.
              </Text>
            )}

            <FieldLabel text="Score Weight" c={c} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([1, 2, 3] as const).map((w) => (
                <TouchableOpacity key={w} onPress={() => setForm((f) => ({ ...f, weight: w }))} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: form.weight === w ? c.primaryFaint : c.surface, borderWidth: 1.5, borderColor: form.weight === w ? c.primary : c.border }}>
                  <Text style={{ color: form.weight === w ? c.primary : c.textSecondary, fontSize: 18, fontWeight: '600' }}>{w}</Text>
                  <Text style={{ color: form.weight === w ? c.primary : c.textMuted, fontSize: 9, marginTop: 2 }}>{w === 1 ? 'Low' : w === 2 ? 'Normal' : 'High'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 20, gap: 10 }}>
              <SwitchRow label="Reminder" value={form.reminder} onChange={(v) => setForm((f) => ({ ...f, reminder: v }))} c={c} />
            </View>

            {editingId && (
              <TouchableOpacity onPress={() => { setModalVisible(false); handleDelete(editingId); }} style={{ marginTop: 32, backgroundColor: c.isDark ? '#3A1A1A' : '#FFF0F0', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.error + '40' }}>
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
    <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 }}>
      {text}
    </Text>
  );
}

function SwitchRow({ label, value, onChange, c }: { label: string; value: boolean; onChange: (v: boolean) => void; c: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.text, fontSize: 15 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor={c.text} />
    </View>
  );
}

function inputStyle(c: any) {
  return {
    backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    padding: 14, color: c.text, fontSize: 15, fontWeight: '400' as const,
  };
}
