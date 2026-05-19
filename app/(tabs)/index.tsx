import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Modal,
  Pressable, Alert, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Calendar from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import { useColors, getCategoryColor } from '../../src/theme/colors';
import { useBlockOverrideStore } from '../../src/store/blockOverrideStore';
import { detectCollisions } from '../../src/utils/collisions';
import {
  useScheduleStore, getUpcomingBlocks,
  getTodayBlocks, DayOfWeek, TimeBlock,
} from '../../src/store/scheduleStore';
import { useSettingsStore, WeekStartDay } from '../../src/store/settingsStore';
import { useLocalEventStore, LocalEvent } from '../../src/store/localEventStore';
import { CurrentBlockBanner } from '../../src/components/CurrentBlockBanner';
import { JarvisChat } from '../../src/components/JarvisChat';
import { router } from 'expo-router';
import {
  usePerformanceStore, computeDailyScore, getScoreColor, getScoreLabel, todayDateKey, fmtDateKey,
} from '../../src/store/performanceStore';
import { useResolutionStore } from '../../src/store/resolutionStore';
import { useHealthKit } from '../../src/utils/healthKit';
import { initAIDataLayer } from '../../src/utils/aiDataLayer';
import { useJarvisStore, buildJarvisStateJson } from '../../src/store/jarvisStore';
import { sendToJarvis } from '../../src/services/groqApi';
import { useProtocolStore } from '../../src/store/protocolStore';
import { useLifeElementStore, computeWeeklyMinutes, fmtWeeklyTime } from '../../src/store/lifeElementStore';

const { width: SW } = Dimensions.get('window');
const WEEK_CENTER = 50;
const TOTAL_WEEKS = 101;
const MAX_WEEK_OFFSET = 12; // ±3 months

const READINESS_COLORS: Record<string, string> = {
  energised: '#3EB87A',
  good: '#5B8FD4',
  average: '#D4A574',
  drained: '#E05C5C',
};

function fmtHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Small segment ring for home widget
function MiniScoreRing({ score, size = 80, segments = 40 }: { score: number; size?: number; segments?: number }) {
  const strokeWidth = 8;
  const color = getScoreColor(score);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const filled = Math.round(pct * segments);
  const r = size / 2 - strokeWidth / 2 - 1;
  const arcLen = (2 * Math.PI * r) / segments;
  const segH = arcLen * 0.76;
  const segW = strokeWidth * 0.62;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size }}>
        {Array.from({ length: segments }, (_, i) => {
          const angleDeg = (i / segments) * 360 - 90;
          const angleRad = angleDeg * (Math.PI / 180);
          const cx = size / 2 + r * Math.cos(angleRad);
          const cy = size / 2 + r * Math.sin(angleRad);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: segW,
                height: segH,
                borderRadius: segW / 2,
                left: cx - segW / 2,
                top: cy - segH / 2,
                backgroundColor: i < filled ? color : 'rgba(255,255,255,0.07)',
                transform: [{ rotate: `${angleDeg}deg` }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}


// ── Helpers ────────────────────────────────────────────────────
function getWeekDays(offset: number, startDay: WeekStartDay = 'monday'): Date[] {
  const today = new Date();
  const todayDow = today.getDay();
  const start = startDay === 'monday' ? 1 : 0;
  const daysBack = (todayDow - start + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysBack + i + offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function getDayPct() {
  const n = new Date();
  return (n.getHours() * 60 + n.getMinutes()) / 1440;
}
function getWeekPct(startDay: WeekStartDay) {
  const n = new Date();
  const start = startDay === 'monday' ? 1 : 0;
  const adjustedDow = (n.getDay() - start + 7) % 7;
  return (adjustedDow * 1440 + n.getHours() * 60 + n.getMinutes()) / (7 * 1440);
}
function getYearPct() {
  const n = new Date();
  const day = Math.floor((n.getTime() - new Date(n.getFullYear(), 0, 0).getTime()) / 86400000);
  const leap = (n.getFullYear() % 4 === 0 && n.getFullYear() % 100 !== 0) || n.getFullYear() % 400 === 0;
  return day / (leap ? 366 : 365);
}
function getWeekOfYear() {
  const n = new Date();
  const soy = new Date(n.getFullYear(), 0, 1);
  return Math.ceil((Math.floor((n.getTime() - soy.getTime()) / 86400000) + soy.getDay() + 1) / 7);
}
function fmt2(h: number, m: number) {
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

// ── Types ──────────────────────────────────────────────────────
interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  isLocal?: boolean;
  isAllDay?: boolean;
}

function localToCalEvent(local: LocalEvent, baseDate: Date): CalEvent {
  if (local.isAllDay) {
    const s = new Date(baseDate); s.setHours(0, 0, 0, 0);
    const e = new Date(baseDate); e.setHours(23, 59, 59, 0);
    return { id: local.id, title: local.title, startDate: s, endDate: e, color: local.color, isLocal: true, isAllDay: true };
  }
  const [sh, sm] = local.startTime.split(':').map(Number);
  const [eh, em] = local.endTime.split(':').map(Number);
  const s = new Date(baseDate); s.setHours(sh, sm, 0, 0);
  const e = new Date(baseDate); e.setHours(eh, em, 0, 0);
  return { id: local.id, title: local.title, startDate: s, endDate: e, color: local.color, isLocal: true };
}

// ── Busyness ───────────────────────────────────────────────────
const BUSYNESS_COLORS = { Light: '#6DB87A', Moderate: '#D4A574', Busy: '#E05C5C' } as const;
type BusyLabel = 'Light' | 'Moderate' | 'Busy';

function getDayBusyness(
  d: Date,
  calEventsMap: Map<string, CalEvent[]>,
  blocks: TimeBlock[],
  localEvts: LocalEvent[],
): { label: BusyLabel; color: string } {
  let mins = 0;
  (calEventsMap.get(d.toDateString()) ?? []).forEach((e) => {
    if (!e.isAllDay) mins += (e.endDate.getTime() - e.startDate.getTime()) / 60000;
  });
  const dow = d.getDay() as DayOfWeek;
  blocks.filter((b) => b.daysOfWeek.includes(dow)).forEach((b) => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    mins += (eh * 60 + em) - (sh * 60 + sm);
  });
  const dateKey = fmtDateKey(d);
  localEvts.filter((e) => e.date === dateKey && !e.isAllDay).forEach((e) => {
    if (e.startTime && e.endTime) {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      mins += (eh * 60 + em) - (sh * 60 + sm);
    }
  });
  const label: BusyLabel = mins >= 300 ? 'Busy' : mins >= 120 ? 'Moderate' : 'Light';
  return { label, color: BUSYNESS_COLORS[label] };
}

// ── ProgressPill ───────────────────────────────────────────────
function ProgressPill({ label, pct, color }: { label: string; pct: number; color: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 9 }}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={{ height: 3, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
      </View>
    </View>
  );
}


// ── Today screen ───────────────────────────────────────────────
export default function TodayScreen() {
  const c = useColors();
  const { blocks, load: loadSchedule } = useScheduleStore();
  const { userName, groqApiKey, weekStartDay } = useSettingsStore();
  const { events: localEvents, load: loadLocalEvents, deleteEvent: deleteLocalEvent } = useLocalEventStore();

  const [now, setNow] = useState(new Date());
  const [weekIdx, setWeekIdx] = useState(WEEK_CENTER);
  const weekOffset = weekIdx - WEEK_CENTER;
  const flatListRef = useRef<FlatList>(null);
  const weekData = useMemo(() => Array.from({ length: TOTAL_WEEKS }, (_, i) => i), []);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calEvents, setCalEvents] = useState<Map<string, CalEvent[]>>(new Map());
  const [calGranted, setCalGranted] = useState(false);
  const [jarvisChatOpen, setJarvisChatOpen] = useState(false);
  const [jarvisInitialMsg, setJarvisInitialMsg] = useState<string | null>(null);

  const { overrides: blockOverrides, load: loadOverrides, getOverride: getBlockOverride } = useBlockOverrideStore();
  const {
    todayEntry: perfEntry,
    load: loadPerf, loaded: perfLoaded,
  } = usePerformanceStore();
  const { getTodayScore: getProtoScore, load: loadProtos } = useProtocolStore();
  const { elements: lifeElements, load: loadElements } = useLifeElementStore();
  const { resolutions, loaded: resLoaded, load: loadRes, getResolution, setPending } = useResolutionStore();
  const { stepGoal, sleepTarget } = useSettingsStore();
  const { steps, sleepHours } = useHealthKit();
  const calEventsRef = useRef<Map<string, CalEvent[]>>(new Map());
  const {
    load: loadJarvis,
    briefingText, briefingLoading, briefingBannerVisible,
    setBriefingText, setBriefingLoading, setBriefingBannerVisible,
    hasBriefingRunToday, markBriefingRanToday, clearBriefingFlag,
  } = useJarvisStore();
  // No dismiss state — banner always shows while there are unresolved past blocks

  // Animation refs for the day popup: backdrop fades in, sheet slides up
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { loadSchedule(); loadLocalEvents(); loadPerf(); loadRes(); loadOverrides(); loadJarvis(); loadProtos(); loadElements(); initAIDataLayer(); }, []);

  // Always-reactive unresolved items — re-evaluates whenever blocks/resolutions/time change
  const unresolvedItems = useMemo(() => {
    if (!resLoaded) return [];
    const today = new Date();
    const todayKey = todayDateKey();
    const nowHHMM = fmtHHMM(today);
    const todayDow = today.getDay();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = fmtDateKey(yesterday);
    const yesterdayDow = yesterday.getDay();

    const items: { blockId: string; date: string; startTime: string }[] = [];
    blocks.forEach((b) => {
      if (b.daysOfWeek.includes(todayDow as DayOfWeek) && b.endTime <= nowHHMM && !getResolution(b.id, todayKey)) {
        items.push({ blockId: b.id, date: todayKey, startTime: b.startTime });
      }
      if (b.daysOfWeek.includes(yesterdayDow as DayOfWeek) && !getResolution(b.id, yesterdayKey)) {
        items.push({ blockId: b.id, date: yesterdayKey, startTime: b.startTime });
      }
    });
    // Sort: yesterday's blocks first, then by startTime
    return items.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [resLoaded, blocks, resolutions, now]);

  // Morning briefing — fires once per calendar day, flag persisted in AsyncStorage
  useEffect(() => {
    if (!groqApiKey) return;
    (async () => {
      const alreadyRan = await hasBriefingRunToday();
      if (alreadyRan) return;
      // Write flag immediately so a crash/close mid-briefing doesn't retrigger
      await markBriefingRanToday();
      setBriefingLoading(true);
      try {
        const stateJson = buildJarvisStateJson();
        const response = await sendToJarvis(groqApiKey, [{ role: 'user', content: '[TRIGGER_MORNING_BRIEFING]' }], stateJson);
        setBriefingText(response.jarvis_speech);
        setBriefingBannerVisible(true);
      } catch {
        // silent fail — no banner shown
      } finally {
        setBriefingLoading(false);
      }
    })();
  }, [groqApiKey]);
  useEffect(() => {
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      if (status === 'granted') { setCalGranted(true); fetchWeekEvents(0); }
    });
  }, []);
  useEffect(() => { if (calGranted) fetchWeekEvents(weekOffset); }, [weekOffset, calGranted]);

  // Animate sheet in when popup opens — backdrop appears instantly via opacity, sheet slides up
  useEffect(() => {
    if (selectedDate) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(sheetAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedDate]);

  const openPopup = useCallback((date: Date) => {
    sheetAnim.setValue(400);
    backdropAnim.setValue(0);
    setSelectedDate(date);
  }, []);

  const closePopup = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 400, duration: 180, useNativeDriver: true }),
    ]).start(() => setSelectedDate(null));
  }, []);

  const fetchWeekEvents = async (offset: number) => {
    try {
      const days = getWeekDays(offset, weekStartDay);
      const start = days[0];
      const end = new Date(days[6]); end.setHours(23, 59, 59);
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const events = await Calendar.getEventsAsync(cals.map((cal) => cal.id), start, end);
      const colorMap = Object.fromEntries(cals.map((cal) => [cal.id, cal.color]));
      const incoming = new Map<string, CalEvent[]>();
      events.forEach((e) => {
        const key = new Date(e.startDate).toDateString();
        if (!incoming.has(key)) incoming.set(key, []);
        incoming.get(key)!.push({
          id: e.id, title: e.title,
          startDate: new Date(e.startDate), endDate: new Date(e.endDate),
          color: colorMap[e.calendarId],
        });
      });
      setCalEvents((prev) => {
        const merged = new Map(prev);
        incoming.forEach((v, k) => merged.set(k, v));
        calEventsRef.current = merged;
        return merged;
      });
    } catch {}
  };

  const onMomentumScrollEnd = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SW);
    const clamped = Math.max(WEEK_CENTER - MAX_WEEK_OFFSET, Math.min(WEEK_CENTER + MAX_WEEK_OFFSET, page));
    if (clamped !== page) {
      flatListRef.current?.scrollToIndex({ index: clamped, animated: true });
    }
    setWeekIdx(clamped);
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SW, offset: SW * index, index,
  }), []);

  const fetchWeekForDate = useCallback(async (date: Date) => {
    if (!calGranted) return;
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date.getTime() - todayMidnight.getTime()) / 86400000);
    const targetOffset = Math.floor(diffDays / 7);
    const targetDays = getWeekDays(targetOffset, weekStartDay);
    const alreadyCached = targetDays.some((d) => calEvents.has(d.toDateString()));
    if (!alreadyCached) fetchWeekEvents(targetOffset);
  }, [calGranted, calEvents, weekStartDay]);

  useEffect(() => {
    if (selectedDate) fetchWeekForDate(selectedDate);
  }, [selectedDate]);

  const confirmDeleteEvent = (e: CalEvent) => {
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
              fetchWeekEvents(weekOffset);
            } catch (err: any) {
              Alert.alert('Cannot delete', err.message ?? 'This event may be read-only.');
            }
          }
        },
      },
    ]);
  };

  const weekDays = getWeekDays(weekOffset, weekStartDay);
  const todayStr = now.toDateString();
  const upcomingBlocks = getUpcomingBlocks(blocks, 3);
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayBlocks = getTodayBlocks(blocks);
  // Override-aware current block: if a block was moved today, match against override times
  const currentBlock = todayBlocks
    .map((b) => {
      const ov = getBlockOverride(b.id, fmtDateKey(now));
      return { ...b, startTime: ov?.overrideStart ?? b.startTime, endTime: ov?.overrideEnd ?? b.endTime };
    })
    .find((b) => b.startTime <= nowTimeStr && nowTimeStr < b.endTime) ?? null;

  // Merge Apple Calendar events + local events for today
  const todayLocalEvts: CalEvent[] = localEvents
    .filter((e) => e.date === fmtDateKey(now))
    .map((e) => localToCalEvent(e, now));
  const todayCalEvents: CalEvent[] = [...(calEvents.get(todayStr) ?? []), ...todayLocalEvts];

  // Merge for selected day popup
  const selectedCalEvents: CalEvent[] = selectedDate
    ? [
        ...(calEvents.get(selectedDate.toDateString()) ?? []),
        ...localEvents
          .filter((e) => e.date === fmtDateKey(selectedDate))
          .map((e) => localToCalEvent(e, selectedDate)),
      ]
    : [];

  const weekOfYear = getWeekOfYear() + weekOffset;
  const dayPct = getDayPct();
  const firstName = userName ? userName.split(' ')[0] : '';

  // Score for widget
  const todayKey = todayDateKey();
  const todayDowNum = now.getDay();
  const todayBlocksForScore = getTodayBlocks(blocks);
  const blockWeightedTotal = todayBlocksForScore.reduce((s, b) => s + (b.weight ?? 2), 0);
  const blockWeightedDone = todayBlocksForScore
    .filter((b) => getResolution(b.id, todayKey)?.status === 'done')
    .reduce((s, b) => s + (b.weight ?? 2), 0);
  const { requiredCompleted: protoCompleted, requiredTotal: protoTotal } = getProtoScore();
  const widgetScore = computeDailyScore({
    protocolRequiredCompleted: protoCompleted,
    protocolRequiredTotal: protoTotal,
    blockWeightedDone, blockWeightedTotal,
    steps, sleepHours, stepGoal, sleepTarget,
  });
  const widgetScoreColor = getScoreColor(widgetScore);
  const beforeNine = now.getHours() < 9;
  const widgetShowStart = beforeNine && widgetScore === 0;
  const greeting = now.getHours() < 5 ? 'Good night' : now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const sameMonth = weekDays[0].getMonth() === weekDays[6].getMonth();
  const weekLabel = sameMonth
    ? `${weekDays[0].toLocaleDateString('en-US', { month: 'short' })} ${weekDays[0].getDate()}–${weekDays[6].getDate()}`
    : `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const renderWeekPage = useCallback(({ item: pageIdx }: { item: number }) => {
    const offset = pageIdx - WEEK_CENTER;
    const days = getWeekDays(offset, weekStartDay);
    const DAY_LETTERS = weekStartDay === 'monday'
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <View style={{ width: SW, flexDirection: 'row', paddingHorizontal: 12, gap: 4 }}>
        {days.map((d, pillIdx) => {
          const isToday = d.toDateString() === todayStr;
          const dayCalEvts = calEvents.get(d.toDateString()) ?? [];
          const hasLocalEvts = localEvents.some((e) => e.date === fmtDateKey(d));
          const hasEvents = dayCalEvts.length > 0 || hasLocalEvts;
          return (
            <TouchableOpacity
              key={pillIdx}
              onPress={() => openPopup(d)}
              style={{
                flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 2,
                alignItems: 'center', gap: 4,
                backgroundColor: isToday ? c.primaryFaint : c.surface,
                borderWidth: 1,
                borderColor: isToday ? c.primary + '70' : c.border,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: isToday ? c.primary : c.textMuted, fontSize: 8, fontWeight: '600' }}>
                {DAY_LETTERS[pillIdx]}
              </Text>
              <Text style={{ color: isToday ? c.primary : c.text, fontSize: 14, fontWeight: isToday ? '600' : '400' }}>
                {d.getDate()}
              </Text>
              {(() => {
                const busy = getDayBusyness(d, calEvents, blocks, localEvents);
                const dKey = fmtDateKey(d);
                const dDow = d.getDay() as DayOfWeek;
                const dBlocks = blocks.filter((b) => b.daysOfWeek.includes(dDow)).map((b) => {
                  const ov = blockOverrides.find((o) => o.blockId === b.id && o.date === dKey);
                  return { id: b.id, title: b.title, startTime: ov?.overrideStart ?? b.startTime, endTime: ov?.overrideEnd ?? b.endTime };
                });
                const dCollisions = detectCollisions(dBlocks, dayCalEvts);
                const hasConflicts = dCollisions.some((col) => col.type !== 'event-event');
                return (
                  <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center', height: 5 }}>
                    {hasEvents && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isToday ? c.primary : c.primary + '90' }} />
                    )}
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: busy.color + (isToday ? 'FF' : 'AA') }} />
                    {hasConflicts && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#E05C5C' + (isToday ? 'FF' : 'AA') }} />
                    )}
                  </View>
                );
              })()}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [calEvents, localEvents, todayStr, weekStartDay, c, openPopup, blocks, blockOverrides]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Day progress line */}
      <View style={{ height: 2.5, backgroundColor: c.border }}>
        <View style={{ width: `${dayPct * 100}%`, height: '100%', backgroundColor: c.primary, opacity: 0.65 }} />
      </View>


      {/* Unresolved blocks banner — always visible while there are unresolved past blocks */}
      {unresolvedItems.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            const first = unresolvedItems[0];
            setPending(first.blockId, first.date);
            router.navigate('/(tabs)/schedule' as any);
          }}
          style={{ marginHorizontal: 12, marginTop: 8, backgroundColor: '#D4A57420', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#D4A574' }}
          activeOpacity={0.7}
        >
          <Ionicons name="alert-circle-outline" size={18} color="#D4A574" />
          <Text style={{ color: '#D4A574', fontSize: 13, flex: 1, fontWeight: '500' }}>
            {unresolvedItems.length} unresolved {unresolvedItems.length === 1 ? 'block' : 'blocks'} — tap to resolve.
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#D4A574" />
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>
            {greeting}{firstName ? `, ${firstName}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 1 }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>Week {getWeekOfYear()}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 54, fontWeight: '200', letterSpacing: -2, marginTop: 4, marginBottom: 12 }}>
            {fmt2(now.getHours(), now.getMinutes())}
          </Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <ProgressPill label="Day" pct={dayPct} color={c.primary} />
            <ProgressPill label="Week" pct={getWeekPct(weekStartDay)} color={c.categories.learning ?? '#5BD4C8'} />
            <ProgressPill label="Year" pct={getYearPct()} color={c.categories.training ?? '#6DB87A'} />
          </View>
        </View>

        {/* Week strip */}
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => { const ni = Math.max(WEEK_CENTER - MAX_WEEK_OFFSET, weekIdx - 1); setWeekIdx(ni); flatListRef.current?.scrollToIndex({ index: ni, animated: true }); }}
              style={{ padding: 4 }}
              disabled={weekIdx <= WEEK_CENTER - MAX_WEEK_OFFSET}
            >
              <Ionicons name="chevron-back" size={18} color={weekIdx <= WEEK_CENTER - MAX_WEEK_OFFSET ? c.border : c.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setWeekIdx(WEEK_CENTER); flatListRef.current?.scrollToIndex({ index: WEEK_CENTER, animated: true }); }}
              activeOpacity={weekOffset !== 0 ? 0.6 : 1}
            >
              <Text style={{ color: weekOffset !== 0 ? c.primary : c.textSecondary, fontSize: 12, fontWeight: '500' }}>
                {weekLabel} · Wk {weekOfYear}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { const ni = Math.min(WEEK_CENTER + MAX_WEEK_OFFSET, weekIdx + 1); setWeekIdx(ni); flatListRef.current?.scrollToIndex({ index: ni, animated: true }); }}
              style={{ padding: 4 }}
              disabled={weekIdx >= WEEK_CENTER + MAX_WEEK_OFFSET}
            >
              <Ionicons name="chevron-forward" size={18} color={weekIdx >= WEEK_CENTER + MAX_WEEK_OFFSET ? c.border : c.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={weekData}
            renderItem={renderWeekPage}
            keyExtractor={(i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={WEEK_CENTER}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            windowSize={3}
            maxToRenderPerBatch={3}
            removeClippedSubviews
          />
        </View>

        {/* Today → day timeline */}
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/schedule' as any)}
          activeOpacity={0.6}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 3 }}
        >
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '500' }}>Today</Text>
          <Ionicons name="chevron-forward" size={11} color={c.textMuted} />
        </TouchableOpacity>

        {/* Stats */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginTop: 16, backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border }}>
          {[{ v: getTodayBlocks(blocks).length, l: 'Blocks' }, { v: upcomingBlocks.length, l: 'Upcoming' }, { v: todayCalEvents.length, l: 'Events' }].map((s, i, a) => (
            <React.Fragment key={s.l}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ color: c.primary, fontSize: 20, fontWeight: '600' }}>{s.v}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 2 }}>{s.l}</Text>
              </View>
              {i < a.length - 1 && <View style={{ width: 1, height: 28, backgroundColor: c.border }} />}
            </React.Fragment>
          ))}
        </View>

        {/* Performance Widget */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/performance')}
          style={{
            marginHorizontal: 12, marginTop: 14,
            backgroundColor: c.surface, borderRadius: 14,
            padding: 14, borderWidth: 1, borderColor: c.border,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
          activeOpacity={0.7}
        >
          <MiniScoreRing score={widgetScore} size={72} segments={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: widgetScoreColor, fontSize: 30, fontWeight: '700', letterSpacing: -1 }}>
              {widgetShowStart ? '—' : widgetScore.toFixed(1)}
            </Text>
            {widgetShowStart ? (
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 1 }}>Start your day</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: steps !== null ? c.textSecondary : c.textMuted, fontSize: 10 }}>
                      👟 {steps !== null ? `${(steps / 1000).toFixed(1)}k` : '—'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: c.textSecondary, fontSize: 10 }}>
                      🎯 {protoTotal > 0 ? `${protoCompleted}/${protoTotal}` : '—'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: sleepHours !== null ? c.textSecondary : c.textMuted, fontSize: 10 }}>
                      🌙 {sleepHours !== null ? `${sleepHours.toFixed(1)}h` : '—'}
                    </Text>
                  </View>
                </View>
                {perfEntry && (
                  <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4, textTransform: 'capitalize' }}>
                    {perfEntry.state}
                  </Text>
                )}
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </TouchableOpacity>

        {/* Life Overview widget */}
        {lifeElements.length > 0 && (() => {
          const topElements = [...lifeElements]
            .map((el) => ({ el, mins: computeWeeklyMinutes(el.name, blocks) }))
            .filter(({ mins }) => mins > 0)
            .sort((a, b) => b.mins - a.mins)
            .slice(0, 3);
          if (topElements.length === 0) return null;
          return (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/overview' as any)}
              style={{
                marginHorizontal: 12, marginTop: 14,
                backgroundColor: c.surface, borderRadius: 14,
                padding: 14, borderWidth: 1, borderColor: c.border,
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', flex: 1 }}>Life Overview</Text>
                <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {topElements.map(({ el, mins }) => (
                  <View key={el.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: el.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13 }}>{el.emoji}</Text>
                    <Text style={{ color: el.color, fontSize: 12, fontWeight: '500' }}>{el.name}</Text>
                    <Text style={{ color: el.color + 'AA', fontSize: 11 }}>· {fmtWeeklyTime(mins)}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })()}

        {/* Current block */}
        <View style={{ marginHorizontal: 12, marginTop: 14 }}>
          {currentBlock ? <CurrentBlockBanner block={currentBlock} /> : (
            <View style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>No active block right now</Text>
            </View>
          )}
        </View>

        {/* Today's calendar events */}
        {todayCalEvents.length > 0 && (
          <View style={{ marginHorizontal: 12, marginTop: 14 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
              Today's Events
            </Text>
            {todayCalEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).map((e) => (
              <TouchableOpacity
                key={e.id}
                onLongPress={() => confirmDeleteEvent(e)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 10, padding: 11, marginBottom: 6, borderWidth: 1, borderColor: c.border }}
              >
                <View style={{ width: 3, height: 32, borderRadius: 2, backgroundColor: e.color ?? c.primary }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{e.title}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 1 }}>
                    {e.isAllDay ? 'All day' : `${e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${e.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </Text>
                </View>
                {e.isLocal && (
                  <Text style={{ color: c.textMuted, fontSize: 10 }}>local</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Today's Plan */}
        {todayBlocks.length > 0 && (
          <View style={{ marginHorizontal: 12, marginTop: 14 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
              Today's Plan
            </Text>
            {todayBlocks.map((b) => {
              const catColor = getCategoryColor(b.category, lifeElements, c);
              const ov = getBlockOverride(b.id, todayKey);
              const dispStart = ov?.overrideStart ?? b.startTime;
              const dispEnd = ov?.overrideEnd ?? b.endTime;
              const isPast = dispEnd <= nowTimeStr;
              const isCurrent = dispStart <= nowTimeStr && dispEnd > nowTimeStr;
              const res = getResolution(b.id, todayKey);
              const isDone = res?.status === 'done';
              const isSkipped = res?.status === 'skipped';
              const isMoved = !!ov;
              const needsResolve = isPast && !res;
              return (
                <View
                  key={b.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
                    borderRadius: 10, padding: 11, marginBottom: 6, gap: 10,
                    borderWidth: 1,
                    borderColor: isDone ? '#3EB87A40' : isSkipped ? c.border : needsResolve ? '#D4A57450' : isCurrent ? catColor + '60' : c.border,
                    opacity: isSkipped ? 0.5 : 1,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDone ? '#3EB87A' : isSkipped ? '#888' : needsResolve ? '#D4A574' : isCurrent ? catColor : catColor + '80' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isDone ? '#3EB87A' : isSkipped ? c.textSecondary : needsResolve ? '#D4A574' : isPast ? c.textSecondary : c.text, fontSize: 13, fontWeight: isCurrent ? '600' : '400', textDecorationLine: isSkipped ? 'line-through' : 'none' }}>
                      {b.title}
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 1, fontStyle: isMoved ? 'italic' : 'normal' }}>
                      {dispStart} – {dispEnd}{isMoved ? ' · moved' : ''}
                    </Text>
                  </View>
                  {needsResolve ? (
                    <TouchableOpacity
                      onPress={() => { setPending(b.id, todayKey); router.push('/(tabs)/schedule'); }}
                      style={{ backgroundColor: '#D4A57420', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: '#D4A57460' }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: '#D4A574', fontSize: 11, fontWeight: '600' }}>Resolve</Text>
                    </TouchableOpacity>
                  ) : isCurrent && !isDone && !isSkipped
                    ? <Text style={{ color: catColor, fontSize: 10, fontWeight: '600' }}>Now</Text>
                    : isDone
                    ? <Ionicons name="checkmark-circle" size={16} color="#3EB87A" />
                    : isSkipped
                    ? <Ionicons name="close-circle" size={16} color="#888" />
                    : <Text style={{ color: isPast ? c.textMuted : catColor, fontSize: 10, fontWeight: '500', textTransform: 'capitalize' }}>{b.category}</Text>
                  }
                </View>
              );
            })}
          </View>
        )}

        {/* Calendar grant prompt */}
        {!calGranted && (
          <TouchableOpacity
            onPress={async () => {
              const { status } = await Calendar.requestCalendarPermissionsAsync();
              if (status === 'granted') { setCalGranted(true); fetchWeekEvents(weekOffset); }
            }}
            style={{ marginHorizontal: 12, marginTop: 14, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>Sync Apple Calendar events</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Briefing banner */}
      {briefingBannerVisible && briefingText && (
        <TouchableOpacity
          onPress={() => { setJarvisInitialMsg(briefingText); setJarvisChatOpen(true); setBriefingBannerVisible(false); }}
          style={{
            marginHorizontal: 12, marginBottom: 6,
            backgroundColor: '#3EB87A18',
            borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center', gap: 10,
            borderWidth: 1, borderColor: '#3EB87A60',
          }}
          activeOpacity={0.7}
        >
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#3EB87A', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>J</Text>
          </View>
          <Text style={{ color: '#3EB87A', fontSize: 13, flex: 1, fontWeight: '500' }}>Jarvis has your briefing →</Text>
          <Ionicons name="chevron-forward" size={14} color="#3EB87A" />
        </TouchableOpacity>
      )}
      {briefingLoading && (
        <View style={{ marginHorizontal: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color="#3EB87A" />
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Jarvis is preparing your briefing…</Text>
        </View>
      )}

      {/* Jarvis FAB */}
      <View style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border }}>
        <TouchableOpacity
          onPress={() => {
            if (!groqApiKey) {
              Alert.alert('Groq API key required', 'Add a free Groq key in Settings to use Jarvis.');
              return;
            }
            setJarvisInitialMsg(null);
            setJarvisChatOpen(true);
          }}
          onLongPress={async () => {
            // [DEV] Long-press to retrigger morning briefing
            await clearBriefingFlag();
            setBriefingText(null);
            setBriefingBannerVisible(false);
            if (!groqApiKey) return;
            setBriefingLoading(true);
            try {
              const stateJson = buildJarvisStateJson();
              const response = await sendToJarvis(groqApiKey, [{ role: 'user', content: '[TRIGGER_MORNING_BRIEFING]' }], stateJson);
              await markBriefingRanToday();
              setBriefingText(response.jarvis_speech);
              setBriefingBannerVisible(true);
            } catch {}
            setBriefingLoading(false);
          }}
          activeOpacity={0.8}
          style={{ alignItems: 'center', gap: 4 }}
        >
          <View style={{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: groqApiKey ? '#3EB87A' : c.border,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#3EB87A', shadowOpacity: groqApiKey ? 0.45 : 0,
            shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>J</Text>
          </View>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '400' }}>
            {groqApiKey ? 'Jarvis' : 'Set up AI'}
          </Text>
        </TouchableOpacity>
      </View>

      <JarvisChat
        visible={jarvisChatOpen}
        onClose={() => { setJarvisChatOpen(false); setJarvisInitialMsg(null); }}
        groqApiKey={groqApiKey}
        initialMessage={jarvisInitialMsg}
      />

      {/* Day detail popup — backdrop fades in instantly, sheet slides up */}
      <Modal visible={!!selectedDate} transparent animationType="none" onRequestClose={closePopup}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop: fades in via opacity, does NOT slide */}
          <Animated.View
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              opacity: backdropAnim,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closePopup} />
          </Animated.View>

          {/* Sheet: slides up from bottom */}
          <Animated.View style={{
            width: '100%',
            backgroundColor: c.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingTop: 12,
            borderTopWidth: 1, borderTopColor: c.border,
            transform: [{ translateY: sheetAnim }],
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

            <View style={{ paddingHorizontal: 20, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>
                  {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                {selectedDate && (() => {
                  const busy = getDayBusyness(selectedDate, calEvents, blocks, localEvents);
                  return (
                    <Text style={{ color: busy.color, fontSize: 12, fontWeight: '600', marginTop: 3 }}>
                      {busy.label === 'Light' ? 'Light day' : busy.label}
                    </Text>
                  );
                })()}
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {selectedCalEvents.length === 0
                    ? 'No calendar events'
                    : `${selectedCalEvents.length} event${selectedCalEvents.length !== 1 ? 's' : ''}`}
                </Text>
              </View>
              <TouchableOpacity onPress={closePopup} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedCalEvents.length === 0 ? (
              <View style={{ paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={32} color={c.textMuted} />
                <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 10 }}>Nothing scheduled</Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
              >
                {[...selectedCalEvents]
                  .sort((a, b) => {
                    if (a.isAllDay && !b.isAllDay) return -1;
                    if (!a.isAllDay && b.isAllDay) return 1;
                    return a.startDate.getTime() - b.startDate.getTime();
                  })
                  .map((e, idx, arr) => (
                    <TouchableOpacity
                      key={e.id}
                      onLongPress={() => confirmDeleteEvent(e)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', gap: 12, alignItems: 'center',
                        backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 14,
                        borderWidth: 1, borderColor: c.border,
                        marginBottom: idx < arr.length - 1 ? 10 : 0,
                      }}
                    >
                      <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: e.color ?? c.primary }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>{e.title}</Text>
                        <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 3 }}>
                          {e.isAllDay
                            ? 'All day'
                            : `${e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${e.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                        </Text>
                        {e.isLocal && (
                          <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 2 }}>Meridian only</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => confirmDeleteEvent(e)} style={{ padding: 8 }}>
                        <Ionicons name="trash-outline" size={15} color={c.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            )}
            <View style={{ height: 44 }} />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
