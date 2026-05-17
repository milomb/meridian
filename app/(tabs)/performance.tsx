import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/theme/colors';
import {
  usePerformanceStore, computeDailyScore, getScoreColor, getScoreLabel, todayDateKey,
  ReadinessState,
} from '../../src/store/performanceStore';
import { useResolutionStore } from '../../src/store/resolutionStore';
import { useScheduleStore, getTodayBlocks, DayOfWeek } from '../../src/store/scheduleStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useHealthKit } from '../../src/utils/healthKit';

// ── Score ring (segment-based, no SVG needed) ──────────────────────
function ScoreRing({ score, size = 200, strokeWidth = 14, segments = 60, children }: {
  score: number; size?: number; strokeWidth?: number; segments?: number;
  children?: React.ReactNode;
}) {
  const color = getScoreColor(score);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const filled = Math.round(pct * segments);
  const r = size / 2 - strokeWidth / 2 - 2;
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
      {children}
    </View>
  );
}

// ── Fill bar ───────────────────────────────────────────────────────
function FillBar({ pct, color, c }: { pct: number; color: string; c: any }) {
  return (
    <View style={{ height: 4, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

const READINESS_OPTIONS: { state: ReadinessState; label: string; color: string }[] = [
  { state: 'energised', label: 'Energised', color: '#3EB87A' },
  { state: 'good',      label: 'Good',      color: '#5B8FD4' },
  { state: 'average',   label: 'Average',   color: '#D4A574' },
  { state: 'drained',   label: 'Drained',   color: '#E05C5C' },
];

let scoreSaveTimer: ReturnType<typeof setTimeout> | null = null;

export default function PerformanceScreen() {
  const c = useColors();
  const {
    morningDone, eveningDone, readiness,
    history, loaded,
    load, setReadiness, toggleMorning, toggleEvening, saveDailyScore, getWeeklyAverage,
  } = usePerformanceStore();
  const { resolutions, loaded: resLoaded, load: loadRes, getResolution } = useResolutionStore();
  const { blocks, load: loadBlocks } = useScheduleStore();
  const { stepGoal, sleepTarget, weeklyAverageMode } = useSettingsStore();
  const { steps, sleepHours } = useHealthKit();

  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => { load(); loadRes(); loadBlocks(); }, []);

  const todayKey = todayDateKey();
  const todayDow = new Date().getDay() as DayOfWeek;
  const todayBlocks = useMemo(() => getTodayBlocks(blocks), [blocks]);

  const blockWeightedTotal = todayBlocks.reduce((s, b) => s + (b.weight ?? 2), 0);
  const blockWeightedDone = todayBlocks
    .filter((b) => getResolution(b.id, todayKey)?.status === 'done')
    .reduce((s, b) => s + (b.weight ?? 2), 0);
  const resolvedCount = todayBlocks.filter((b) => getResolution(b.id, todayKey)?.status === 'done').length;
  const skippedCount = todayBlocks.filter((b) => getResolution(b.id, todayKey)?.status === 'skipped').length;

  const score = computeDailyScore({
    morningDone, eveningDone,
    blockWeightedDone, blockWeightedTotal,
    steps, sleepHours, stepGoal, sleepTarget,
  });

  const isLocked = new Date().getHours() >= 21;
  const scoreColor = getScoreColor(score);

  // Persist score to history (debounced)
  useEffect(() => {
    if (!loaded || !resLoaded) return;
    if (scoreSaveTimer) clearTimeout(scoreSaveTimer);
    scoreSaveTimer = setTimeout(() => saveDailyScore(score), 1500);
    return () => { if (scoreSaveTimer) clearTimeout(scoreSaveTimer); };
  }, [score, loaded, resLoaded]);

  const weeklyAvg = getWeeklyAverage(weeklyAverageMode);
  const displayScore = viewMode === 'weekly' ? (weeklyAvg ?? 0) : score;
  const displayColor = getScoreColor(displayScore);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Steps progress
  const stepsPct = steps !== null ? Math.min(1, steps / stepGoal) : null;
  const sleepPct = sleepHours !== null ? Math.min(1, sleepHours / sleepTarget) : null;
  const blocksPct = blockWeightedTotal > 0 ? blockWeightedDone / blockWeightedTotal : 0;
  const protocolPct = (morningDone ? 0.5 : 0) + (eveningDone ? 0.5 : 0);

  function fmtSteps(n: number | null): string {
    if (n === null) return '—';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k / ${(stepGoal / 1000).toFixed(0)}k` : `${n} / ${stepGoal}`;
  }

  function fmtSleep(h: number | null): string {
    if (h === null) return '—';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Performance
          </Text>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '600', marginTop: 2 }}>Daily Score</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 1 }}>{today}</Text>
        </View>

        {/* Daily / Weekly toggle */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 2, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start' }}>
          {(['daily', 'weekly'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => setViewMode(v)}
              style={{ paddingHorizontal: 18, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === v ? c.surface : 'transparent' }}
            >
              <Text style={{ color: viewMode === v ? c.text : c.textMuted, fontSize: 13, fontWeight: '500', textTransform: 'capitalize' }}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Score ring */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <ScoreRing score={displayScore} size={200} strokeWidth={15} segments={72}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 56, fontWeight: '700', letterSpacing: -2 }}>
                {displayScore.toFixed(1)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isLocked ? '#3EB87A' : c.textMuted }} />
                <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '500' }}>
                  {viewMode === 'weekly' ? (weeklyAverageMode === 'rolling' ? '7-day avg' : 'this week') : (isLocked ? 'Final' : 'Day in progress')}
                </Text>
              </View>
            </View>
          </ScoreRing>
          <Text style={{ color: displayColor, fontSize: 15, fontWeight: '600', marginTop: 10, letterSpacing: 0.2 }}>
            {getScoreLabel(displayScore)}
          </Text>
        </View>

        {/* Breakdown */}
        <View style={{ marginHorizontal: 12, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginTop: 8 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
            Breakdown
          </Text>

          {/* Protocols */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border + '88' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Protocols</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                {morningDone ? '☀️ ✓' : '☀️ ✗'}  {eveningDone ? '🌙 ✓' : '🌙 ✗'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <FillBar pct={protocolPct} color={getScoreColor(protocolPct * 100)} c={c} />
              <Text style={{ color: c.textMuted, fontSize: 11, minWidth: 48, textAlign: 'right' }}>
                {morningDone && eveningDone ? '2/2' : morningDone || eveningDone ? '1/2' : '0/2'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={toggleMorning}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: morningDone ? '#3EB87A18' : c.surfaceAlt, borderWidth: 1.5, borderColor: morningDone ? '#3EB87A' : c.border }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15 }}>☀️</Text>
                <Text style={{ color: morningDone ? '#3EB87A' : c.textSecondary, fontSize: 13, fontWeight: '500', flex: 1 }}>Morning</Text>
                {morningDone && <Ionicons name="checkmark-circle" size={16} color="#3EB87A" />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleEvening}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: eveningDone ? '#5B8FD418' : c.surfaceAlt, borderWidth: 1.5, borderColor: eveningDone ? '#5B8FD4' : c.border }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15 }}>🌙</Text>
                <Text style={{ color: eveningDone ? '#5B8FD4' : c.textSecondary, fontSize: 13, fontWeight: '500', flex: 1 }}>Evening</Text>
                {eveningDone && <Ionicons name="checkmark-circle" size={16} color="#5B8FD4" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Blocks */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border + '88' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Blocks</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                {resolvedCount}/{todayBlocks.length} resolved
                {skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <FillBar pct={blocksPct} color={getScoreColor(blocksPct * 100)} c={c} />
              <Text style={{ color: c.textMuted, fontSize: 11, minWidth: 48, textAlign: 'right' }}>
                {Math.round(blocksPct * 100)}%
              </Text>
            </View>
          </View>

          {/* Steps */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border + '88' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Steps</Text>
              <Text style={{ color: steps !== null ? c.textSecondary : c.textMuted, fontSize: 12 }}>
                {fmtSteps(steps)}
              </Text>
            </View>
            {stepsPct !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FillBar pct={stepsPct} color={getScoreColor(stepsPct * 100)} c={c} />
                <Text style={{ color: c.textMuted, fontSize: 11, minWidth: 48, textAlign: 'right' }}>
                  {Math.round(stepsPct * 100)}%
                </Text>
              </View>
            ) : (
              <Text style={{ color: c.textMuted, fontSize: 11 }}>HealthKit not connected — weight redistributed</Text>
            )}
          </View>

          {/* Sleep */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }}>Sleep</Text>
              <Text style={{ color: sleepHours !== null ? c.textSecondary : c.textMuted, fontSize: 12 }}>
                {sleepHours !== null ? `${fmtSleep(sleepHours)} / ${sleepTarget}h` : '—'}
              </Text>
            </View>
            {sleepPct !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <FillBar pct={sleepPct} color={getScoreColor(sleepPct * 100)} c={c} />
                <Text style={{ color: c.textMuted, fontSize: 11, minWidth: 48, textAlign: 'right' }}>
                  {Math.round(sleepPct * 100)}%
                </Text>
              </View>
            ) : (
              <Text style={{ color: c.textMuted, fontSize: 11 }}>HealthKit not connected — weight redistributed</Text>
            )}
          </View>
        </View>

        {/* Readiness */}
        <View style={{ marginHorizontal: 12, backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginTop: 12 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            Readiness
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {READINESS_OPTIONS.map((opt) => {
              const selected = readiness === opt.state;
              return (
                <TouchableOpacity
                  key={opt.state}
                  onPress={() => setReadiness(opt.state)}
                  activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11, backgroundColor: selected ? opt.color + '22' : c.surfaceAlt, borderWidth: 1.5, borderColor: selected ? opt.color : c.border }}
                >
                  <Text style={{ color: selected ? opt.color : c.textMuted, fontSize: 11, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!readiness && (
            <Text style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
              Tap to log readiness — not used in score
            </Text>
          )}
        </View>

        {/* Placeholder integrations */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, gap: 10, marginTop: 12 }}>
          {['Whoop', 'Strava'].map((name) => (
            <View key={name} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', gap: 6 }}>
              <Ionicons name="watch-outline" size={22} color={c.textMuted} />
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '500' }}>{name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 10 }}>Coming soon</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
