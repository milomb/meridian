import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, Modal,
  Pressable, TextInput, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as Calendar from 'expo-calendar';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { sendMessageWithTools, ChatMessage, ProviderConfig } from '../../src/ai/client';
import { useColors, getCategoryColor } from '../../src/theme/colors';
import {
  useScheduleStore, getCurrentBlock, getUpcomingBlocks,
  getTodayBlocks, DayOfWeek,
} from '../../src/store/scheduleStore';
import { useSettingsStore, WeekStartDay } from '../../src/store/settingsStore';
import { useLocalEventStore, LocalEvent } from '../../src/store/localEventStore';
import { CurrentBlockBanner } from '../../src/components/CurrentBlockBanner';

const { width: SW } = Dimensions.get('window');
const WEEK_CENTER = 50;
const TOTAL_WEEKS = 101;

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
function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// ── Voice / JarvisFab ──────────────────────────────────────────
let cachedVoice: string | undefined;
async function getBestVoice() {
  if (cachedVoice !== undefined) return cachedVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const en = voices.filter((v) => v.language?.startsWith('en'));
    cachedVoice = en.find((v) => /premium|enhanced/i.test(v.name ?? ''))?.identifier ?? en[0]?.identifier ?? '';
  } catch { cachedVoice = ''; }
  return cachedVoice;
}

interface FabTurn { role: 'user' | 'assistant'; content: string; }

function JarvisFab({
  groqApiKey, userName, onActionChange,
}: {
  groqApiKey: string; userName: string;
  onActionChange: (label: string | null) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [response, setResponse] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [history, setHistory] = useState<FabTurn[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  const activeKey = groqApiKey;

  useEffect(() => {
    if (phase !== 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      ringAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
      Animated.timing(ringAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [phase]);

  const dismiss = () => {
    Speech.stop();
    setOpen(false);
    setPhase('idle');
    setResponse('');
    setShowInput(false);
    setInputText('');
    setHistory([]);
    onActionChange(null);
  };

  const speakReply = async (text: string) => {
    try { await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false }); } catch {}
    const voice = await getBestVoice();
    setPhase('speaking');
    Speech.speak(text, {
      rate: 0.9, pitch: 1.0, language: 'en-US',
      ...(voice ? { voice } : {}),
      onDone: () => setPhase('idle'),
      onError: () => setPhase('idle'),
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || phase === 'thinking') return;
    setInputText('');
    setPhase('thinking');
    setResponse('');
    const newHistory: FabTurn[] = [...history, { role: 'user', content: trimmed }];
    setHistory(newHistory);
    try {
      const chatHistory: ChatMessage[] = newHistory.map((t) => ({ role: t.role, content: t.content }));
      const config: ProviderConfig = { provider: 'groq', apiKey: groqApiKey };
      const result = await sendMessageWithTools(chatHistory, userName, config);
      if (result.actionResult) {
        onActionChange(result.actionResult);
        setTimeout(() => onActionChange(null), 4000);
      } else {
        onActionChange(null);
      }
      setResponse(result.text);
      setHistory((prev) => [...prev, { role: 'assistant', content: result.text }]);
      speakReply(result.text);
    } catch (err: any) {
      setHistory((prev) => prev.slice(0, -1));
      setPhase('idle');
      setResponse(err.message ?? 'Error — check your connection.');
    }
  };

  const openModal = () => {
    if (!activeKey) { Alert.alert('Groq API key required', 'Add a free Groq key in Browse → Settings to use AI.'); return; }
    setOpen(true);
    setPhase('idle');
    setResponse('');
    setShowInput(true);
  };

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 0] });

  return (
    <>
      <TouchableOpacity onPress={openModal} activeOpacity={0.8} style={{ alignItems: 'center', gap: 4 }}>
        <View style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: activeKey ? c.primary : c.border,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: c.primary, shadowOpacity: activeKey ? 0.45 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 6,
        }}>
          <Ionicons name="mic-outline" size={26} color={activeKey ? (c.isDark ? c.bg : '#fff') : c.textMuted} />
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '400' }}>
          {activeKey ? 'Meridian' : 'Set up AI'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', inset: 0 }} onPress={phase === 'idle' ? dismiss : undefined} />

          <View style={{ position: 'absolute', top: 80, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', letterSpacing: 3, textTransform: 'uppercase' }}>
              Meridian
            </Text>
          </View>

          {response ? (
            <View style={{ position: 'absolute', top: 120, left: 36, right: 36, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '300', textAlign: 'center', lineHeight: 28 }}>
                {response}
              </Text>
              {phase === 'speaking' && (
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 14, letterSpacing: 2 }}>● ● ●</Text>
              )}
            </View>
          ) : phase === 'thinking' ? (
            <View style={{ position: 'absolute', top: 160, alignItems: 'center' }}>
              <ActivityIndicator color="rgba(255,255,255,0.5)" />
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 10, fontWeight: '300' }}>thinking</Text>
            </View>
          ) : null}

          <View style={{ alignItems: 'center', justifyContent: 'center', width: 120, height: 120 }}>
            <Animated.View style={{
              position: 'absolute', width: 100, height: 100, borderRadius: 50,
              borderWidth: 1, borderColor: c.primary,
              transform: [{ scale: ringScale }], opacity: ringOpacity,
            }} />
            <Animated.View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: phase !== 'idle' ? c.primary : 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: phase !== 'idle' ? c.primary : 'rgba(255,255,255,0.12)',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: pulseAnim }],
            }}>
              <Ionicons
                name={phase === 'speaking' ? 'volume-high-outline' : 'mic-outline'}
                size={34}
                color={phase !== 'idle' ? (c.isDark ? c.bg : '#fff') : 'rgba(255,255,255,0.5)'}
              />
            </Animated.View>
          </View>

          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {showInput && (
                <View style={{ padding: 24, paddingBottom: 48, gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                    <TextInput
                      style={{
                        flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                        padding: 14, color: '#fff', fontSize: 15, fontWeight: '300',
                      }}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder="Speak or type, then tap ↑ …"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      autoFocus
                      returnKeyType="send"
                      blurOnSubmit
                      onSubmitEditing={() => send(inputText)}
                    />
                    <TouchableOpacity
                      onPress={() => send(inputText)}
                      disabled={!inputText.trim() || phase === 'thinking'}
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: inputText.trim() && phase !== 'thinking' ? c.primary : 'rgba(255,255,255,0.08)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="arrow-up" size={18} color={inputText.trim() && phase !== 'thinking' ? (c.isDark ? c.bg : '#fff') : 'rgba(255,255,255,0.3)'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Use 🎙 on keyboard to dictate, then tap ↑ to send
                  </Text>
                  <TouchableOpacity onPress={dismiss} style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Today screen ───────────────────────────────────────────────
export default function TodayScreen() {
  const c = useColors();
  const { blocks, load: loadSchedule } = useScheduleStore();
  const { userName, groqApiKey, customCategories, weekStartDay } = useSettingsStore();
  const { events: localEvents, load: loadLocalEvents, deleteEvent: deleteLocalEvent } = useLocalEventStore();

  const [now, setNow] = useState(new Date());
  const [weekIdx, setWeekIdx] = useState(WEEK_CENTER);
  const weekOffset = weekIdx - WEEK_CENTER;
  const flatListRef = useRef<FlatList>(null);
  const weekData = useMemo(() => Array.from({ length: TOTAL_WEEKS }, (_, i) => i), []);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calEvents, setCalEvents] = useState<Map<string, CalEvent[]>>(new Map());
  const [calGranted, setCalGranted] = useState(false);
  const [fabActionLabel, setFabActionLabel] = useState<string | null>(null);

  // Animation refs for the day popup: backdrop fades in, sheet slides up
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { loadSchedule(); loadLocalEvents(); getBestVoice(); }, []);
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
        return merged;
      });
    } catch {}
  };

  const onMomentumScrollEnd = useCallback((e: any) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SW);
    setWeekIdx(page);
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
  const currentBlock = getCurrentBlock(blocks);
  const upcomingBlocks = getUpcomingBlocks(blocks, 3);

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
              <View style={{ height: 5, alignItems: 'center', justifyContent: 'center' }}>
                {hasEvents && (
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isToday ? c.primary : c.primary + '90' }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [calEvents, localEvents, todayStr, weekStartDay, c, openPopup]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Day progress line */}
      <View style={{ height: 2.5, backgroundColor: c.border }}>
        <View style={{ width: `${dayPct * 100}%`, height: '100%', backgroundColor: c.primary, opacity: 0.65 }} />
      </View>

      {/* Floating action status pill */}
      {fabActionLabel && (
        <View style={{ position: 'absolute', top: 28, left: 0, right: 0, zIndex: 99, alignItems: 'center' }}>
          <View style={{
            backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            borderWidth: 1, borderColor: c.border,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
          }}>
            <ActivityIndicator size="small" color={c.primary} />
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>{fabActionLabel}</Text>
          </View>
        </View>
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
              onPress={() => { const ni = weekIdx - 1; setWeekIdx(ni); flatListRef.current?.scrollToIndex({ index: ni, animated: true }); }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={18} color={c.primary} />
            </TouchableOpacity>
            <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '500' }}>
              {weekLabel} · Wk {weekOfYear}
            </Text>
            <TouchableOpacity
              onPress={() => { const ni = weekIdx + 1; setWeekIdx(ni); flatListRef.current?.scrollToIndex({ index: ni, animated: true }); }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-forward" size={18} color={c.primary} />
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

        {/* Coming up */}
        {upcomingBlocks.length > 0 && (
          <View style={{ marginHorizontal: 12, marginTop: 14 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
              Coming Up
            </Text>
            {upcomingBlocks.map((b) => {
              const catColor = getCategoryColor(b.category, customCategories, c);
              return (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 10, padding: 11, marginBottom: 6, borderWidth: 1, borderColor: c.border, gap: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{b.title}</Text>
                    <Text style={{ color: c.textSecondary, fontSize: 11, marginTop: 1 }}>{b.startTime} – {b.endTime}</Text>
                  </View>
                  <Text style={{ color: catColor, fontSize: 10, fontWeight: '500', textTransform: 'capitalize' }}>{b.category}</Text>
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

      {/* Jarvis FAB */}
      <View style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.border }}>
        <JarvisFab groqApiKey={groqApiKey} userName={userName} onActionChange={setFabActionLabel} />
      </View>

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
