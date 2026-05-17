import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryColor } from '../theme/colors';
import { TimeBlock, DayOfWeek } from '../store/scheduleStore';
import { useResolutionStore, ResolutionStatus } from '../store/resolutionStore';

export interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  isLocal?: boolean;
  isAllDay?: boolean;
}

export const TL_HOUR_H = 56;
export const TL_LABEL_W = 52;
export const TL_END = 24;

export function DayTimeline({
  day, scheduleBlocks, calEvents, c, customCategories, onDayChange,
  pendingOpenBlockId, pendingOpenDate, onPendingClear,
}: {
  day: Date;
  scheduleBlocks: TimeBlock[];
  calEvents: CalEvent[];
  c: any;
  customCategories: any[];
  onDayChange: (d: Date) => void;
  pendingOpenBlockId?: string | null;
  pendingOpenDate?: string | null;
  onPendingClear?: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const { getResolution, resolveBlock } = useResolutionStore();
  const [resSheet, setResSheet] = useState<TimeBlock | null>(null);
  const [resStatus, setResStatus] = useState<ResolutionStatus | null>(null);
  const [resRating, setResRating] = useState<number | null>(null);
  const [resNote, setResNote] = useState('');

  const now = new Date();
  const nowMidnight = new Date(now); nowMidnight.setHours(0, 0, 0, 0);
  const dayMidnight = new Date(day); dayMidnight.setHours(0, 0, 0, 0);
  const isToday = dayMidnight.getTime() === nowMidnight.getTime();
  const isFutureDay = dayMidnight > nowMidnight;

  const dayDow = day.getDay() as DayOfWeek;
  const dayBlocks = scheduleBlocks.filter((b) => b.daysOfWeek.includes(dayDow));
  const allDayEvts = calEvents.filter((e) => e.isAllDay);
  const timedEvts = calEvents.filter((e) => !e.isAllDay);
  const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Dynamic timeline start: go earlier than 6am if something is scheduled there
  const allStartHours = [
    ...dayBlocks.map((b) => parseInt(b.startTime.split(':')[0], 10)),
    ...timedEvts.map((e) => e.startDate.getHours()),
  ];
  const tlStart = allStartHours.length > 0 ? Math.min(6, Math.min(...allStartHours)) : 6;
  const HOURS = Array.from({ length: TL_END - tlStart }, (_, i) => tlStart + i);
  const gridH = (TL_END - tlStart) * TL_HOUR_H;

  function tlTop(h: number, m: number): number {
    return ((h + m / 60) - tlStart) * TL_HOUR_H;
  }

  // Auto-scroll to current time when viewing today
  useEffect(() => {
    if (!isToday) return;
    const offset = Math.max(0, ((now.getHours() + now.getMinutes() / 60) - tlStart - 1.5) * TL_HOUR_H);
    setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: false }), 80);
  }, [day, tlStart]);

  // Auto-open resolution sheet for pending block (from banner deep-link)
  useEffect(() => {
    if (!pendingOpenBlockId || !pendingOpenDate || dateKey !== pendingOpenDate) return;
    const block = dayBlocks.find((b) => b.id === pendingOpenBlockId);
    if (block) {
      openResSheet(block);
      onPendingClear?.();
    }
  }, [pendingOpenBlockId, pendingOpenDate, dateKey, dayBlocks]);

  const prevDay = () => { const d = new Date(day); d.setDate(d.getDate() - 1); onDayChange(d); };
  const nextDay = () => { const d = new Date(day); d.setDate(d.getDate() + 1); onDayChange(d); };
  const goToday = () => onDayChange(new Date());

  function fmtHourTL(h: number): string {
    if (h === 0 || h === 24) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  const openResSheet = (b: TimeBlock) => {
    const existing = getResolution(b.id, dateKey);
    setResStatus(existing?.status ?? null);
    setResRating(existing?.outcome.rating ?? null);
    setResNote(existing?.outcome.note ?? '');
    setResSheet(b);
  };

  const saveResolution = () => {
    if (!resSheet || !resStatus) return;
    resolveBlock(resSheet.id, dateKey, resStatus, { rating: resRating, note: resNote.trim() || null });
    setResSheet(null); setResStatus(null); setResRating(null); setResNote('');
  };

  const fmtDayLabel = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1 }}>
      {/* Day nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        <TouchableOpacity onPress={prevDay} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={20} color={c.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} style={{ flex: 1, alignItems: 'center' }} activeOpacity={isToday ? 1 : 0.6}>
          <Text style={{ color: isToday ? c.primary : c.text, fontSize: 16, fontWeight: '600' }}>
            {isToday ? 'Today' : fmtDayLabel(day)}
          </Text>
          {!isToday && <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 1 }}>Tap to return to today</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={nextDay} style={{ padding: 6 }}>
          <Ionicons name="chevron-forward" size={20} color={c.primary} />
        </TouchableOpacity>
      </View>

      {allDayEvts.length > 0 && (
        <View style={{ paddingHorizontal: TL_LABEL_W + 8, paddingBottom: 8, gap: 4 }}>
          {allDayEvts.map((e) => (
            <View key={e.id} style={{ borderRadius: 5, backgroundColor: (e.color ?? c.primary) + '25', paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: e.color ?? c.primary, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{e.title}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
        <View style={{ height: gridH, position: 'relative' }}>
          {/* Hour lines */}
          {HOURS.map((h) => (
            <View key={h} style={{ position: 'absolute', top: (h - tlStart) * TL_HOUR_H, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ width: TL_LABEL_W, textAlign: 'right', paddingRight: 10, color: c.textMuted, fontSize: 9, lineHeight: 11 }}>{fmtHourTL(h)}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border + '55', marginTop: 4 }} />
            </View>
          ))}
          {/* Half-hour ticks */}
          {HOURS.map((h) => (
            <View key={`hh${h}`} style={{ position: 'absolute', top: (h - tlStart) * TL_HOUR_H + TL_HOUR_H / 2, left: TL_LABEL_W, right: 0, height: 1, backgroundColor: c.border + '22' }} />
          ))}
          {/* Now line */}
          {isToday && now.getHours() >= tlStart && now.getHours() < TL_END && (
            <View style={{ position: 'absolute', top: tlTop(now.getHours(), now.getMinutes()), left: TL_LABEL_W - 4, right: 0, height: 1.5, backgroundColor: c.primary, opacity: 0.9, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary, marginTop: -3 }} />
            </View>
          )}

          {/* Calendar events */}
          {timedEvts.map((e) => {
            const top = tlTop(e.startDate.getHours(), e.startDate.getMinutes());
            const h = Math.max(28, (e.endDate.getTime() - e.startDate.getTime()) / 3600000 * TL_HOUR_H);
            const color = e.color ?? c.primary;
            return (
              <View key={e.id} style={{ position: 'absolute', top, left: TL_LABEL_W + 4, right: 0, height: h, borderRadius: 6, borderWidth: 1.5, borderColor: color + 'BB', backgroundColor: color + '14', padding: 4, overflow: 'hidden' }}>
                <Text style={{ color, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>{e.title}</Text>
                <Text style={{ color: color + 'AA', fontSize: 9 }} numberOfLines={1}>
                  {e.startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – {e.endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  {e.isLocal ? '  ·  local' : ''}
                </Text>
              </View>
            );
          })}

          {/* Schedule blocks */}
          {dayBlocks.map((b) => {
            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            const top = tlTop(sh, sm);
            const h = Math.max(28, ((eh + em / 60) - (sh + sm / 60)) * TL_HOUR_H);
            const catColor = getCategoryColor(b.category, customCategories, c);

            // A block is resolvable only if it has ended: past day, or today with endTime passed
            const canResolve = !isFutureDay && (isToday ? b.endTime <= nowHHMM : true);
            const resolution = getResolution(b.id, dateKey);
            const isUnresolved = canResolve && !resolution;
            const isDone = resolution?.status === 'done';
            const isSkipped = resolution?.status === 'skipped';
            const borderColor = isUnresolved ? '#D4A574' : isDone ? '#3EB87A' : isSkipped ? '#888' : catColor;

            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => canResolve && openResSheet(b)}
                activeOpacity={canResolve ? 0.7 : 1}
                style={{
                  position: 'absolute', top, left: TL_LABEL_W + 4, right: 0, height: h, borderRadius: 6,
                  backgroundColor: isUnresolved ? '#D4A57412' : isDone ? '#3EB87A12' : isSkipped ? c.border + '18' : catColor + '28',
                  borderLeftWidth: 3, borderLeftColor: borderColor, padding: 4, overflow: 'hidden',
                  opacity: isSkipped ? 0.55 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text style={{ color: isUnresolved ? '#D4A574' : isDone ? '#3EB87A' : catColor, fontSize: 10, fontWeight: '700', flex: 1 }} numberOfLines={1}>{b.title}</Text>
                  {isUnresolved && h > 30 && <Ionicons name="ellipse" size={6} color="#D4A574" style={{ marginTop: 2 }} />}
                  {isDone && h > 30 && <Ionicons name="checkmark-circle" size={10} color="#3EB87A" />}
                  {isSkipped && h > 30 && <Ionicons name="close-circle" size={10} color="#888" />}
                </View>
                {h > 34 && (
                  <Text style={{ color: (isUnresolved ? '#D4A574' : isDone ? '#3EB87A' : catColor) + 'BB', fontSize: 9 }} numberOfLines={1}>
                    {b.startTime} – {b.endTime}{canResolve && !resolution ? '  · tap to resolve' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Resolution sheet */}
      <Modal visible={!!resSheet} transparent animationType="slide" onRequestClose={() => setResSheet(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setResSheet(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: 40 }}>
              <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 18 }} />
              <View style={{ paddingHorizontal: 20, marginBottom: 18 }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{resSheet?.title}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{resSheet?.startTime} – {resSheet?.endTime}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginHorizontal: 20, gap: 12, marginBottom: 20 }}>
                {(['done', 'skipped'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setResStatus(s)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: resStatus === s ? (s === 'done' ? '#3EB87A22' : '#88888822') : c.surfaceAlt, borderWidth: 2, borderColor: resStatus === s ? (s === 'done' ? '#3EB87A' : '#888') : c.border }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={s === 'done' ? 'checkmark-circle' : 'close-circle'} size={22} color={resStatus === s ? (s === 'done' ? '#3EB87A' : '#888') : c.textMuted} />
                    <Text style={{ color: resStatus === s ? (s === 'done' ? '#3EB87A' : c.textSecondary) : c.textMuted, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                      {s === 'done' ? 'Done' : 'Skipped'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  How did it go? (optional)
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setResRating(resRating === star ? null : star)} style={{ padding: 4 }}>
                      <Ionicons name={resRating !== null && star <= resRating ? 'star' : 'star-outline'} size={26} color={resRating !== null && star <= resRating ? '#D4A574' : c.border} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput value={resNote} onChangeText={setResNote} placeholder="One-line note…" placeholderTextColor={c.textMuted} style={{ backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 14 }} maxLength={120} returnKeyType="done" />
              </View>
              <TouchableOpacity onPress={saveResolution} disabled={!resStatus} style={{ marginHorizontal: 20, paddingVertical: 15, borderRadius: 13, backgroundColor: resStatus ? c.primary : c.border, alignItems: 'center' }} activeOpacity={0.7}>
                <Text style={{ color: resStatus ? (c.isDark ? c.bg : '#fff') : c.textMuted, fontSize: 15, fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
