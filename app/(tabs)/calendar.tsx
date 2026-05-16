import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { colors } from '../../src/theme/colors';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarId: string;
  calendarColor?: string;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());

  const requestAccess = useCallback(async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
      loadEvents(viewMonth);
    } else {
      Alert.alert('Calendar access denied', 'Enable in Settings to sync your Apple Calendar.');
    }
  }, [viewMonth]);

  const loadEvents = useCallback(async (month: Date) => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const start = new Date(month.getFullYear(), month.getMonth(), 1);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      const calEvents = await Calendar.getEventsAsync(
        calendars.map((c) => c.id),
        start,
        end
      );
      const calMap = Object.fromEntries(calendars.map((c) => [c.id, c.color]));
      setEvents(
        calEvents.map((e) => ({
          id: e.id,
          title: e.title,
          startDate: new Date(e.startDate),
          endDate: new Date(e.endDate),
          calendarId: e.calendarId,
          calendarColor: calMap[e.calendarId],
        }))
      );
    } catch {
      // permissions might be revoked
    }
  }, []);

  useEffect(() => {
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setHasPermission(true);
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

  const prevMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d: number) =>
    d === selectedDate.getDate() &&
    month === selectedDate.getMonth() &&
    year === selectedDate.getFullYear();

  const hasEvent = (d: number) =>
    events.some(
      (e) => e.startDate.getDate() === d && e.startDate.getMonth() === month && e.startDate.getFullYear() === year
    );

  const selectedEvents = events.filter(
    (e) =>
      e.startDate.getDate() === selectedDate.getDate() &&
      e.startDate.getMonth() === selectedDate.getMonth() &&
      e.startDate.getFullYear() === selectedDate.getFullYear()
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAYS.map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.cell,
              d != null && isSelected(d) ? styles.cellSelected : undefined,
              d != null && isToday(d) && !isSelected(d) ? styles.cellToday : undefined,
            ]}
            onPress={() => d && setSelectedDate(new Date(year, month, d))}
            disabled={!d}
          >
            {d && (
              <>
                <Text
                  style={[
                    styles.cellText,
                    isToday(d) && !isSelected(d) && styles.cellTextToday,
                    isSelected(d) && styles.cellTextSelected,
                  ]}
                >
                  {d}
                </Text>
                {hasEvent(d) && (
                  <View style={[styles.eventDot, isSelected(d) && styles.eventDotSelected]} />
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Events for selected date */}
      <ScrollView style={styles.events} contentContainerStyle={styles.eventsContent}>
        <Text style={styles.eventsTitle}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>

        {!hasPermission && (
          <TouchableOpacity onPress={requestAccess} style={styles.syncBtn}>
            <Text style={styles.syncBtnText}>Sync Apple Calendar</Text>
          </TouchableOpacity>
        )}

        {hasPermission && selectedEvents.length === 0 && (
          <Text style={styles.noEvents}>No events</Text>
        )}

        {selectedEvents.map((e) => (
          <View key={e.id} style={[styles.event, { borderLeftColor: e.calendarColor ?? colors.primary }]}>
            <Text style={styles.eventTitle}>{e.title}</Text>
            <Text style={styles.eventTime}>
              {e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
              {e.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  monthTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  navBtn: { padding: 8 },
  navBtnText: { color: colors.primary, fontSize: 26, fontWeight: '300' },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
  },
  cellToday: { borderWidth: 1, borderColor: colors.primary },
  cellSelected: { backgroundColor: colors.primary },
  cellText: { color: colors.text, fontSize: 14 },
  cellTextToday: { color: colors.primary, fontWeight: '700' },
  cellTextSelected: { color: colors.bg, fontWeight: '700' },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  eventDotSelected: { backgroundColor: colors.bg },
  events: { flex: 1 },
  eventsContent: { padding: 20, paddingBottom: 40 },
  eventsTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  syncBtn: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '60',
    marginBottom: 16,
  },
  syncBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  noEvents: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 24 },
  event: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  eventTime: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
});
