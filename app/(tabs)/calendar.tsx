import React, { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { useColors } from '../../src/theme/colors';
import { useLocalEventStore, LocalEvent } from '../../src/store/localEventStore';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarId: string;
  calendarColor?: string;
  notes?: string;
  isLocal?: boolean;
  isAllDay?: boolean;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const PRESET_COLORS = [
  '#5B8FD4', '#6DB87A', '#D4A574', '#A78BFA',
  '#F87171', '#64B5F6', '#F59E0B', '#34D399',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function parseTime(base: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}
function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const c = useColors();
  const { events: localEvents, load: loadLocalEvents, addEvent: addLocalEvent, deleteEvent: deleteLocalEvent } = useLocalEventStore();

  const [hasPermission, setHasPermission] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [addModalVisible, setAddModalVisible] = useState(false);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [newAllDay, setNewAllDay] = useState(false);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newNotes, setNewNotes] = useState('');
  const [newTemporary, setNewTemporary] = useState(false);

  const resetModal = () => {
    setNewTitle('');
    setNewStart('09:00');
    setNewEnd('10:00');
    setNewAllDay(false);
    setNewColor(PRESET_COLORS[0]);
    setNewNotes('');
    setNewTemporary(false);
    setAddModalVisible(false);
  };

  const requestAccess = useCallback(async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
      loadCalendars();
    } else {
      Alert.alert('Calendar access denied', 'Enable in Settings to sync your Apple Calendar.');
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      setCalendars(cals);
    } catch {}
  }, []);

  const loadEvents = useCallback(async (month: Date) => {
    try {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      const calEvents = await Calendar.getEventsAsync(cals.map((c) => c.id), start, end);
      const calMap = Object.fromEntries(cals.map((c) => [c.id, c.color]));
      setEvents(
        calEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startDate: new Date(e.startDate),
          endDate: new Date(e.endDate),
          calendarId: e.calendarId,
          calendarColor: calMap[e.calendarId],
          notes: e.notes,
          isAllDay: e.allDay,
        }))
      );
    } catch {}
  }, []);

  useEffect(() => {
    loadLocalEvents();
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setHasPermission(true);
        loadCalendars();
        loadEvents(viewMonth);
      }
    });
  }, []);

  useEffect(() => {
    if (hasPermission) loadEvents(viewMonth);
  }, [viewMonth, hasPermission]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) =>
    d === selectedDate.getDate() &&
    month === selectedDate.getMonth() &&
    year === selectedDate.getFullYear();

  const calEventsForDay = (d: number): CalendarEvent[] =>
    events.filter(
      (e) =>
        e.startDate.getDate() === d &&
        e.startDate.getMonth() === month &&
        e.startDate.getFullYear() === year
    );

  const localEventsForDay = (d: number): CalendarEvent[] =>
    localEvents
      .filter((e) => {
        const date = new Date(e.date + 'T00:00:00');
        return date.getDate() === d && date.getMonth() === month && date.getFullYear() === year;
      })
      .map((e) => {
        const base = new Date(year, month, d);
        return {
          id: e.id,
          title: e.title,
          startDate: e.isAllDay ? new Date(year, month, d, 0, 0, 0) : parseTime(base, e.startTime),
          endDate: e.isAllDay ? new Date(year, month, d, 23, 59, 59) : parseTime(base, e.endTime),
          calendarId: '',
          calendarColor: e.color,
          notes: e.notes || undefined,
          isLocal: true,
          isAllDay: e.isAllDay,
        };
      });

  const allEventsForDay = (d: number): CalendarEvent[] =>
    [...calEventsForDay(d), ...localEventsForDay(d)];

  const selectedEvents = allEventsForDay(selectedDate.getDate()).filter(
    (e) =>
      e.startDate.getMonth() === selectedDate.getMonth() &&
      e.startDate.getFullYear() === selectedDate.getFullYear()
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const handleDeleteEvent = (e: CalendarEvent) => {
    Alert.alert('Delete Event', `Delete "${e.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (e.isLocal) {
            deleteLocalEvent(e.id);
          } else {
            try {
              await Calendar.deleteEventAsync(e.id);
              loadEvents(viewMonth);
            } catch (err: any) {
              Alert.alert('Cannot delete', err.message ?? 'This event may be read-only.');
            }
          }
        },
      },
    ]);
  };

  const addEvent = async () => {
    if (!newTitle.trim()) return;

    if (newTemporary) {
      addLocalEvent({
        title: newTitle.trim(),
        date: fmtDateKey(selectedDate),
        startTime: newAllDay ? '' : newStart,
        endTime: newAllDay ? '' : newEnd,
        isAllDay: newAllDay,
        color: newColor,
        notes: newNotes,
      });
      resetModal();
      return;
    }

    try {
      const defaultCal = calendars.find((cal) => cal.allowsModifications) ?? calendars[0];
      if (!defaultCal) {
        Alert.alert('No writable calendar found');
        return;
      }
      const d = selectedDate;
      let startDate: Date, endDate: Date;
      if (newAllDay) {
        startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      } else {
        const [sh, sm] = newStart.split(':').map(Number);
        const [eh, em] = newEnd.split(':').map(Number);
        startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm);
        endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);
      }
      await Calendar.createEventAsync(defaultCal.id, {
        title: newTitle.trim(),
        startDate,
        endDate,
        allDay: newAllDay,
        notes: newNotes || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      resetModal();
      loadEvents(viewMonth);
      Alert.alert('Event added', `"${newTitle}" added to ${defaultCal.title}`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not create event');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
      >
        <Ionicons name="chevron-back" size={20} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: '400' }}>Back</Text>
      </TouchableOpacity>

      {/* Month nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 }}>
        <TouchableOpacity
          onPress={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          style={{ padding: 8 }}
        >
          <Text style={{ color: c.primary, fontSize: 26, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '600' }}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity
          onPress={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          style={{ padding: 8 }}
        >
          <Text style={{ color: c.primary, fontSize: 26, fontWeight: '300' }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day header */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 }}>
        {DAYS.map((d, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11, fontWeight: '600' }}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginBottom: 12 }}>
        {cells.map((d, i) => {
          const dayEvents = d ? allEventsForDay(d) : [];
          const selected = d != null && isSelected(d);
          const todayDay = d != null && isToday(d);
          return (
            <TouchableOpacity
              key={i}
              style={{
                width: `${100 / 7}%`,
                height: 64,
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 6,
                borderRadius: 10,
                backgroundColor: selected ? c.primary : 'transparent',
                borderWidth: todayDay && !selected ? 1 : 0,
                borderColor: c.primary,
              }}
              onPress={() => d && setSelectedDate(new Date(year, month, d))}
              disabled={!d}
            >
              {d && (
                <>
                  <Text style={{
                    color: selected ? (c.isDark ? c.bg : '#fff') : todayDay ? c.primary : c.text,
                    fontSize: 14,
                    fontWeight: selected || todayDay ? '600' : '400',
                    marginBottom: 3,
                  }}>
                    {d}
                  </Text>
                  <View style={{ gap: 2, width: '90%' }}>
                    {dayEvents.slice(0, 2).map((e) => (
                      <View
                        key={e.id}
                        style={{
                          borderRadius: 3,
                          paddingHorizontal: 3,
                          backgroundColor: (e.calendarColor ?? c.primary) + (selected ? '60' : '30'),
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? (c.isDark ? c.bg : '#fff') : (e.calendarColor ?? c.primary),
                            fontSize: 8,
                            fontWeight: '500',
                          }}
                          numberOfLines={1}
                        >
                          {e.title}
                        </Text>
                      </View>
                    ))}
                    {dayEvents.length > 2 && (
                      <Text style={{ color: c.textMuted, fontSize: 8, paddingHorizontal: 3 }}>
                        +{dayEvents.length - 2}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day events */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={{
              backgroundColor: c.primaryFaint, borderRadius: 16,
              paddingHorizontal: 12, paddingVertical: 6,
              borderWidth: 1, borderColor: c.primary + '60',
            }}
          >
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '500' }}>+ Event</Text>
          </TouchableOpacity>
        </View>

        {!hasPermission && (
          <TouchableOpacity
            onPress={requestAccess}
            style={{ backgroundColor: c.primaryFaint, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: c.primary + '60', marginBottom: 16 }}
          >
            <Text style={{ color: c.primary, fontSize: 15, fontWeight: '500' }}>Sync Apple Calendar</Text>
          </TouchableOpacity>
        )}

        {selectedEvents.length === 0 && (
          <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20, fontWeight: '400' }}>
            No events — tap + Event to add one
          </Text>
        )}

        {selectedEvents
          .sort((a, b) => {
            if (a.isAllDay && !b.isAllDay) return -1;
            if (!a.isAllDay && b.isAllDay) return 1;
            return a.startDate.getTime() - b.startDate.getTime();
          })
          .map((e) => (
            <TouchableOpacity
              key={e.id}
              onLongPress={() => handleDeleteEvent(e)}
              activeOpacity={0.75}
              style={{
                backgroundColor: c.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                borderLeftWidth: 3,
                borderLeftColor: e.calendarColor ?? c.primary,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '500', marginBottom: 4 }}>{e.title}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '400' }}>
                    {e.isAllDay
                      ? 'All day'
                      : `${e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${e.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </Text>
                  {e.notes ? (
                    <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6, fontWeight: '400' }} numberOfLines={2}>
                      {e.notes}
                    </Text>
                  ) : null}
                  {e.isLocal && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: e.calendarColor ?? c.primary }} />
                      <Text style={{ color: c.textMuted, fontSize: 10 }}>Meridian only</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteEvent(e)} style={{ padding: 4, marginLeft: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
      </ScrollView>

      {/* Add event modal */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 20, paddingTop: 60,
            borderBottomWidth: 1, borderBottomColor: c.border,
          }}>
            <TouchableOpacity onPress={resetModal}>
              <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>New Event</Text>
            <TouchableOpacity onPress={addEvent}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {/* Date label */}
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>

            {/* Title */}
            <TextInput
              style={{
                backgroundColor: c.surface, borderRadius: 12,
                borderWidth: 1, borderColor: c.border,
                padding: 14, color: c.text, fontSize: 16, fontWeight: '400',
              }}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event title"
              placeholderTextColor={c.textMuted}
              autoFocus
            />

            {/* All-day toggle */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: c.surface, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: c.border,
            }}>
              <Text style={{ color: c.text, fontSize: 15 }}>All Day</Text>
              <Switch
                value={newAllDay}
                onValueChange={setNewAllDay}
                trackColor={{ false: c.border, true: c.primary + '60' }}
                thumbColor={newAllDay ? c.primary : c.textMuted}
              />
            </View>

            {/* Time fields */}
            {!newAllDay && (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Start</Text>
                  <TextInput
                    style={{
                      backgroundColor: c.surface, borderRadius: 10,
                      borderWidth: 1, borderColor: c.border,
                      padding: 12, color: c.text, fontSize: 15,
                    }}
                    value={newStart}
                    onChangeText={setNewStart}
                    placeholder="09:00"
                    placeholderTextColor={c.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>End</Text>
                  <TextInput
                    style={{
                      backgroundColor: c.surface, borderRadius: 10,
                      borderWidth: 1, borderColor: c.border,
                      padding: 12, color: c.text, fontSize: 15,
                    }}
                    value={newEnd}
                    onChangeText={setNewEnd}
                    placeholder="10:00"
                    placeholderTextColor={c.textMuted}
                  />
                </View>
              </View>
            )}

            {/* Notes */}
            <TextInput
              style={{
                backgroundColor: c.surface, borderRadius: 12,
                borderWidth: 1, borderColor: c.border,
                padding: 14, color: c.text, fontSize: 15, fontWeight: '400',
                height: 80, textAlignVertical: 'top',
              }}
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="Add notes…"
              placeholderTextColor={c.textMuted}
              multiline
            />

            {/* Save destination toggle */}
            <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              <TouchableOpacity
                onPress={() => setNewTemporary(false)}
                style={{ flexDirection: 'row', padding: 14, alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 2, borderColor: !newTemporary ? c.primary : c.border,
                  backgroundColor: !newTemporary ? c.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {!newTemporary && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.isDark ? c.bg : '#fff' }} />}
                </View>
                <View>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Apple Calendar</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>Syncs to Google Calendar</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setNewTemporary(true)}
                style={{ flexDirection: 'row', padding: 14, alignItems: 'center', gap: 12 }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 2, borderColor: newTemporary ? c.primary : c.border,
                  backgroundColor: newTemporary ? c.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {newTemporary && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.isDark ? c.bg : '#fff' }} />}
                </View>
                <View>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Meridian Only</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>Stored locally, not synced</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Color picker — only meaningful for local events */}
            {newTemporary && (
              <View>
                <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '500', marginBottom: 10 }}>Color</Text>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewColor(color)}
                      style={{
                        width: 34, height: 34, borderRadius: 17,
                        backgroundColor: color,
                        borderWidth: 2,
                        borderColor: newColor === color ? c.text : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                      activeOpacity={0.8}
                    >
                      {newColor === color && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
