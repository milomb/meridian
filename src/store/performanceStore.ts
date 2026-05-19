import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReadinessState = 'energised' | 'good' | 'average' | 'drained';

// Legacy compat
export interface ReadinessEntry {
  date: string;
  state: ReadinessState;
}

export interface DailyScore {
  date: string; // YYYY-MM-DD
  score: number; // 0–100 with one decimal
  locked: boolean;
}

export interface ScoreInputs {
  morningDone: boolean;
  eveningDone: boolean;
  blockWeightedDone: number;
  blockWeightedTotal: number;
  steps: number | null;
  sleepHours: number | null;
  stepGoal: number;
  sleepTarget: number;
}

export function computeDailyScore(inputs: ScoreInputs): number {
  const { morningDone, eveningDone, blockWeightedDone, blockWeightedTotal,
          steps, sleepHours, stepGoal, sleepTarget } = inputs;

  const stepsAvail = steps !== null;
  const sleepAvail = sleepHours !== null;

  const w = {
    protocol: 0.30,
    blocks: 0.35,
    steps: stepsAvail ? 0.20 : 0,
    sleep: sleepAvail ? 0.15 : 0,
  };
  const wSum = w.protocol + w.blocks + w.steps + w.sleep;

  const pProtocol = (morningDone ? 0.5 : 0) + (eveningDone ? 0.5 : 0);
  const pBlocks = blockWeightedTotal > 0 ? Math.min(1, blockWeightedDone / blockWeightedTotal) : 1;
  const pSteps = stepsAvail ? Math.min(1, steps! / stepGoal) : 0;
  const pSleep = sleepAvail ? Math.min(1, sleepHours! / sleepTarget) : 0;

  const raw = (pProtocol * w.protocol + pBlocks * w.blocks + pSteps * w.steps + pSleep * w.sleep) / wSum;
  return Math.round(raw * 1000) / 10;
}

export function getScoreColor(score: number): string {
  if (score < 40) return '#888888';
  if (score < 60) return '#D4A574';
  if (score < 80) return '#5B8FD4';
  if (score < 90) return '#3EB87A';
  return '#00E566';
}

export function getScoreLabel(score: number): string {
  if (score < 40) return 'Tough day';
  if (score < 60) return 'Getting there';
  if (score < 80) return 'Solid';
  if (score < 90) return 'Strong';
  return 'Peak';
}

export function fmtDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PerformanceStore {
  morningDone: boolean;
  eveningDone: boolean;
  readiness: ReadinessState | null;
  history: DailyScore[];
  loaded: boolean;
  // legacy
  todayEntry: ReadinessEntry | null;

  load: () => Promise<void>;
  setReadiness: (state: ReadinessState) => void;
  toggleMorning: () => void;
  toggleEvening: () => void;
  saveDailyScore: (score: number) => void;
  getWeeklyAverage: (mode: 'rolling' | 'calendar') => number | null;
}

const STORAGE_KEY = '@meridian:performance_v2';
const HISTORY_KEY = '@meridian:score_history';
const LEGACY_KEY = '@meridian:performance';

async function persistProtocols(morningDone: boolean, eveningDone: boolean, readiness: ReadinessState | null) {
  const today = todayDateKey();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, morningDone, eveningDone, readiness }));
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  morningDone: false,
  eveningDone: false,
  readiness: null,
  history: [],
  loaded: false,
  todayEntry: null,

  load: async () => {
    try {
      const today = todayDateKey();

      // Load today's protocol state
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let morningDone = false, eveningDone = false, readiness: ReadinessState | null = null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.date === today) {
          morningDone = saved.morningDone ?? false;
          eveningDone = saved.eveningDone ?? false;
          readiness = saved.readiness ?? null;
        }
      }

      // Load score history
      const histRaw = await AsyncStorage.getItem(HISTORY_KEY);
      const history: DailyScore[] = histRaw ? JSON.parse(histRaw) : [];

      // Legacy readiness compat
      const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
      const legacyAll: ReadinessEntry[] = legacyRaw ? JSON.parse(legacyRaw) : [];
      const todayEntry = legacyAll.find((e) => e.date === today) ?? null;
      if (todayEntry && !readiness) readiness = todayEntry.state;

      set({ morningDone, eveningDone, readiness, history, loaded: true, todayEntry });
    } catch {
      set({ loaded: true });
    }
  },

  setReadiness: (readiness) => {
    const { morningDone, eveningDone } = get();
    set({ readiness, todayEntry: { date: todayDateKey(), state: readiness } });
    persistProtocols(morningDone, eveningDone, readiness);
  },

  toggleMorning: () => {
    const { morningDone, eveningDone, readiness } = get();
    const next = !morningDone;
    set({ morningDone: next });
    persistProtocols(next, eveningDone, readiness);
  },

  toggleEvening: () => {
    const { morningDone, eveningDone, readiness } = get();
    const next = !eveningDone;
    set({ eveningDone: next });
    persistProtocols(morningDone, next, readiness);
  },

  saveDailyScore: (score) => {
    const today = todayDateKey();
    const locked = new Date().getHours() >= 21;
    const existing = get().history.filter((h) => h.date !== today);
    const updated = [{ date: today, score, locked }, ...existing].slice(0, 28);
    set({ history: updated });
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  },

  getWeeklyAverage: (mode) => {
    const { history } = get();
    if (history.length === 0) return null;

    const now = new Date();
    let dates: string[];

    if (mode === 'rolling') {
      dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
    } else {
      // Calendar week Mon–Sun
      const dow = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dow + 6) % 7));
      dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
    }

    const relevant = history.filter((h) => dates.includes(h.date));
    if (relevant.length === 0) return null;
    return Math.round((relevant.reduce((s, h) => s + h.score, 0) / relevant.length) * 10) / 10;
  },
}));
