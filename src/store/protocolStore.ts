import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROTOCOL_COLORS = [
  '#5B8FD4', '#6DB87A', '#D4A574', '#A78BFA',
  '#F87171', '#64B5F6', '#F59E0B', '#34D399',
] as const;

export type CompletionState = 'complete' | 'partial' | 'missed' | 'pending';
export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'custom';

export interface ProtocolStep {
  id: string;
  label: string;
  type: 'required' | 'bonus';
}

export interface StreakMilestone {
  days: number;
  achievedAt: string; // YYYY-MM-DD
}

export interface Protocol {
  id: string;
  name: string;
  icon: string;
  color: string;
  timeOfDay: TimeOfDay;
  customTime?: string; // HH:MM
  steps: ProtocolStep[];
  activeDays: number[]; // 0 = Sun
  createdAt: string;
  archivedAt?: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
  milestones: StreakMilestone[];
}

export interface ProtocolLog {
  protocolId: string;
  date: string; // YYYY-MM-DD
  completedStepIds: string[];
}

const PROTO_KEY = '@meridian:protocols_v1';
const LOGS_KEY = '@meridian:protocol_logs_v1';
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90];
const TOD_ORDER: TimeOfDay[] = ['morning', 'midday', 'evening', 'custom'];

export function protoDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveState(
  protocol: Protocol,
  log: ProtocolLog | undefined,
  date: string,
  today: string,
): CompletionState {
  const required = protocol.steps.filter((s) => s.type === 'required');
  if (!log || log.completedStepIds.length === 0) {
    return date >= today ? 'pending' : 'missed';
  }
  if (required.length === 0) return 'complete';
  const doneCount = required.filter((s) => log.completedStepIds.includes(s.id)).length;
  if (doneCount === required.length) return 'complete';
  if (doneCount > 0) return 'partial';
  return date >= today ? 'pending' : 'missed';
}

function recomputeStreaks(protocols: Protocol[], logs: ProtocolLog[]): Protocol[] {
  const today = protoDateKey();
  return protocols.map((p) => {
    if (p.archivedAt) return p;
    let streak = 0;
    let longest = p.longestStreak;
    const milestones = [...p.milestones];
    let lastCompleted = p.lastCompletedDate;

    const cursor = new Date();
    for (let i = 0; i < 90; i++) {
      const dk = protoDateKey(cursor);
      const dow = cursor.getDay();
      cursor.setDate(cursor.getDate() - 1);
      if (!p.activeDays.includes(dow)) continue;
      const log = logs.find((l) => l.protocolId === p.id && l.date === dk);
      const state = resolveState(p, log, dk, today);
      if (state === 'pending') continue;
      if (state === 'complete' || state === 'partial') {
        if (streak === 0 && !lastCompleted) lastCompleted = dk;
        streak++;
      } else {
        break;
      }
    }

    if (streak > longest) longest = streak;
    for (const ms of STREAK_MILESTONES) {
      if (streak >= ms && !milestones.find((m) => m.days === ms)) {
        milestones.push({ days: ms, achievedAt: today });
      }
    }
    return { ...p, currentStreak: streak, longestStreak: longest, milestones, lastCompletedDate: lastCompleted };
  });
}

const DEFAULT_PROTOCOLS: Protocol[] = [
  {
    id: 'default-morning', name: 'Morning', icon: '☀️', color: '#D4A574',
    timeOfDay: 'morning',
    steps: [
      { id: 'dm-1', label: 'Make bed', type: 'required' },
      { id: 'dm-2', label: 'Cold shower', type: 'required' },
      { id: 'dm-3', label: 'Vitamins', type: 'required' },
      { id: 'dm-4', label: 'Meditate', type: 'required' },
    ],
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    currentStreak: 0, longestStreak: 0, milestones: [],
  },
  {
    id: 'default-evening', name: 'Evening', icon: '🌙', color: '#5B8FD4',
    timeOfDay: 'evening',
    steps: [
      { id: 'de-1', label: 'Journal', type: 'required' },
      { id: 'de-2', label: 'Read 10 pages', type: 'required' },
      { id: 'de-3', label: "Tomorrow's schedule reviewed", type: 'bonus' },
    ],
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    createdAt: new Date().toISOString(),
    currentStreak: 0, longestStreak: 0, milestones: [],
  },
];

export type ProtocolDraft = Omit<Protocol, 'id' | 'createdAt' | 'currentStreak' | 'longestStreak' | 'milestones' | 'archivedAt'>;

interface ProtocolStore {
  protocols: Protocol[];
  logs: ProtocolLog[];
  loaded: boolean;
  load: () => Promise<void>;
  addProtocol: (data: ProtocolDraft) => void;
  updateProtocol: (id: string, updates: Partial<ProtocolDraft>) => void;
  archiveProtocol: (id: string) => void;
  toggleStep: (protocolId: string, date: string, stepId: string) => void;
  getLog: (protocolId: string, date: string) => ProtocolLog | undefined;
  getCompletionState: (protocolId: string, date: string) => CompletionState;
  getTodayScore: () => { requiredCompleted: number; requiredTotal: number };
  sortedActiveProtocols: () => Protocol[];
}

async function persist(protocols: Protocol[], logs: ProtocolLog[]) {
  await AsyncStorage.multiSet([
    [PROTO_KEY, JSON.stringify(protocols)],
    [LOGS_KEY, JSON.stringify(logs)],
  ]);
}

export const useProtocolStore = create<ProtocolStore>((set, get) => ({
  protocols: [],
  logs: [],
  loaded: false,

  load: async () => {
    try {
      const [[, protoRaw], [, logsRaw]] = await AsyncStorage.multiGet([PROTO_KEY, LOGS_KEY]);
      const protocols: Protocol[] = protoRaw ? JSON.parse(protoRaw) : DEFAULT_PROTOCOLS;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffKey = protoDateKey(cutoff);
      const allLogs: ProtocolLog[] = logsRaw ? JSON.parse(logsRaw) : [];
      const logs = allLogs.filter((l) => l.date >= cutoffKey);
      set({ protocols: recomputeStreaks(protocols, logs), logs, loaded: true });
    } catch {
      set({ protocols: DEFAULT_PROTOCOLS, logs: [], loaded: true });
    }
  },

  addProtocol: (data) => {
    const protocol: Protocol = {
      ...data, id: Date.now().toString(), createdAt: new Date().toISOString(),
      currentStreak: 0, longestStreak: 0, milestones: [],
    };
    const protocols = [...get().protocols, protocol];
    set({ protocols });
    persist(protocols, get().logs);
  },

  updateProtocol: (id, updates) => {
    const protocols = get().protocols.map((p) => p.id === id ? { ...p, ...updates } : p);
    set({ protocols });
    persist(protocols, get().logs);
  },

  archiveProtocol: (id) => {
    const protocols = get().protocols.map((p) =>
      p.id === id ? { ...p, archivedAt: new Date().toISOString() } : p
    );
    set({ protocols });
    persist(protocols, get().logs);
  },

  toggleStep: (protocolId, date, stepId) => {
    const logs = [...get().logs];
    const idx = logs.findIndex((l) => l.protocolId === protocolId && l.date === date);
    if (idx >= 0) {
      const cur = logs[idx];
      logs[idx] = {
        ...cur,
        completedStepIds: cur.completedStepIds.includes(stepId)
          ? cur.completedStepIds.filter((id) => id !== stepId)
          : [...cur.completedStepIds, stepId],
      };
    } else {
      logs.push({ protocolId, date, completedStepIds: [stepId] });
    }
    const protocols = recomputeStreaks(get().protocols, logs);
    set({ protocols, logs });
    persist(protocols, logs);
  },

  getLog: (protocolId, date) =>
    get().logs.find((l) => l.protocolId === protocolId && l.date === date),

  getCompletionState: (protocolId, date) => {
    const proto = get().protocols.find((p) => p.id === protocolId);
    if (!proto) return 'missed';
    return resolveState(proto, get().getLog(protocolId, date), date, protoDateKey());
  },

  getTodayScore: () => {
    const today = protoDateKey();
    const todayDow = new Date().getDay();
    let requiredTotal = 0;
    let requiredCompleted = 0;
    get().protocols
      .filter((p) => !p.archivedAt && p.activeDays.includes(todayDow))
      .forEach((p) => {
        const log = get().getLog(p.id, today);
        const required = p.steps.filter((s) => s.type === 'required');
        requiredTotal += required.length;
        if (log) requiredCompleted += required.filter((s) => log.completedStepIds.includes(s.id)).length;
      });
    return { requiredCompleted, requiredTotal };
  },

  sortedActiveProtocols: () =>
    get().protocols
      .filter((p) => !p.archivedAt)
      .sort((a, b) => TOD_ORDER.indexOf(a.timeOfDay) - TOD_ORDER.indexOf(b.timeOfDay)),
}));
