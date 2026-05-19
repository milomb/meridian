import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScheduleStore, getTodayBlocks, getBlocksForDay, DayOfWeek } from './scheduleStore';
import { useResolutionStore } from './resolutionStore';
import { useBlockOverrideStore } from './blockOverrideStore';
import { usePerformanceStore, todayDateKey, fmtDateKey } from './performanceStore';
import { useSettingsStore } from './settingsStore';

const JARVIS_PROFILE_KEY = '@meridian:jarvis_profile';

export interface JarvisProfile {
  core_goals: string[];
  coaching_style: string;
}

interface JarvisStore {
  profile: JarvisProfile;
  briefingText: string | null;
  briefingLoading: boolean;
  briefingBannerVisible: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setProfile: (updates: Partial<JarvisProfile>) => void;
  setBriefingText: (text: string | null) => void;
  setBriefingLoading: (loading: boolean) => void;
  setBriefingBannerVisible: (visible: boolean) => void;
  hasBriefingRunToday: () => Promise<boolean>;
  markBriefingRanToday: () => Promise<void>;
  clearBriefingFlag: () => Promise<void>;
}

const DEFAULT_PROFILE: JarvisProfile = {
  core_goals: ['elite physical performance', 'disciplined deep work', 'consistent sleep'],
  coaching_style: 'direct_mentor',
};

export const useJarvisStore = create<JarvisStore>((set, get) => ({
  profile: DEFAULT_PROFILE,
  briefingText: null,
  briefingLoading: false,
  briefingBannerVisible: false,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(JARVIS_PROFILE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      set({ profile: { ...DEFAULT_PROFILE, ...saved }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setProfile: (updates) => {
    const profile = { ...get().profile, ...updates };
    set({ profile });
    AsyncStorage.setItem(JARVIS_PROFILE_KEY, JSON.stringify(profile));
  },

  setBriefingText: (briefingText) => set({ briefingText }),
  setBriefingLoading: (briefingLoading) => set({ briefingLoading }),
  setBriefingBannerVisible: (briefingBannerVisible) => set({ briefingBannerVisible }),

  hasBriefingRunToday: async () => {
    const key = `briefing_flag_${todayDateKey()}`;
    const val = await AsyncStorage.getItem(key);
    return val === 'true';
  },

  markBriefingRanToday: async () => {
    const key = `briefing_flag_${todayDateKey()}`;
    await AsyncStorage.setItem(key, 'true');
  },

  clearBriefingFlag: async () => {
    const key = `briefing_flag_${todayDateKey()}`;
    await AsyncStorage.removeItem(key);
  },
}));

// Assembles the full Jarvis state JSON from all stores (not a hook — reads .getState())
export function buildJarvisStateJson(): string {
  const settings = useSettingsStore.getState();
  const schedule = useScheduleStore.getState();
  const resolution = useResolutionStore.getState();
  const overrides = useBlockOverrideStore.getState();
  const perf = usePerformanceStore.getState();
  const jarvis = useJarvisStore.getState();

  const today = new Date();
  const todayKey = todayDateKey();
  const todayDow = today.getDay() as DayOfWeek;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = fmtDateKey(yesterday);
  const yesterdayDow = yesterday.getDay() as DayOfWeek;
  const nowHHMM = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const todayBlocks = getTodayBlocks(schedule.blocks);
  const today_schedule = todayBlocks.map((b) => {
    const ov = overrides.getOverride(b.id, todayKey);
    const startTime = (ov?.overrideStart ?? b.startTime) || '00:00';
    const endTime = (ov?.overrideEnd ?? b.endTime) || '00:00';
    const res = resolution.getResolution(b.id, todayKey);
    let status: 'PENDING' | 'COMPLETED' | 'SKIPPED' = 'PENDING';
    if (res?.status === 'done') status = 'COMPLETED';
    if (res?.status === 'skipped') status = 'SKIPPED';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return {
      id: b.id,
      name: b.title,
      time: startTime,
      duration_minutes: (eh * 60 + em) - (sh * 60 + sm),
      status,
      weight: b.weight ?? 2,
      is_fixed: b.isFixed,
      rating: res?.outcome.rating ?? null,
      note: res?.outcome.note ?? null,
    };
  });

  const yesterdayBlocks = getBlocksForDay(schedule.blocks, yesterdayDow);
  const yesterday_blocks_detail = yesterdayBlocks.map((b) => {
    const res = resolution.getResolution(b.id, yesterdayKey);
    return {
      name: b.title,
      status: res?.status === 'done' ? 'COMPLETED' : res?.status === 'skipped' ? 'SKIPPED' : 'UNRESOLVED',
      rating: res?.outcome.rating ?? null,
      note: res?.outcome.note ?? null,
    };
  });
  const completed_blocks = yesterday_blocks_detail.filter((b) => b.status === 'COMPLETED').map((b) => b.name);
  const skipped_blocks = yesterday_blocks_detail.filter((b) => b.status === 'SKIPPED').map((b) => b.name);

  const yesterdayScore = perf.history.find((h) => h.date === yesterdayKey);
  const todayScore = perf.history.find((h) => h.date === todayKey);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const state = {
    user_profile: {
      name: settings.userName || 'User',
      core_goals: jarvis.profile.core_goals,
      coaching_style: jarvis.profile.coaching_style,
    },
    time_context: {
      current_date: todayKey,
      day_of_week: DAY_NAMES[todayDow],
      current_time: nowHHMM,
    },
    yesterday_review: {
      performance_score: yesterdayScore?.score ?? 0,
      blocks: yesterday_blocks_detail,
      completed_blocks,
      skipped_blocks,
    },
    today_schedule,
    today_performance_score: todayScore?.score ?? 0,
    has_run_briefing_today: jarvis.briefingText !== null,
  };

  return JSON.stringify(state, null, 2);
}

// ── Dev seed function ─────────────────────────────────────────────────────────
// Call from console or a dev button. Overwrites yesterday's resolution + perf data.

export async function __seedDevState(scenario: 'A' | 'B'): Promise<void> {
  const schedule = useScheduleStore.getState();
  const perf = usePerformanceStore.getState();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = fmtDateKey(yesterday);
  const yesterdayDow = yesterday.getDay() as DayOfWeek;
  const yesterdayBlocks = getBlocksForDay(schedule.blocks, yesterdayDow);

  if (scenario === 'A') {
    // Perfect Yesterday: score 94, all blocks done
    const resolutions = yesterdayBlocks.map((b) => ({
      blockId: b.id,
      date: yesterdayKey,
      status: 'done' as const,
      outcome: { rating: 5, note: 'Felt locked in all day, PR on bench.' },
      resolvedAt: new Date().toISOString(),
    }));
    const raw = await AsyncStorage.getItem('@meridian:resolutions').catch(() => null);
    const existing = raw ? JSON.parse(raw) : [];
    const cleaned = existing.filter((r: any) => r.date !== yesterdayKey);
    await AsyncStorage.setItem('@meridian:resolutions', JSON.stringify([...resolutions, ...cleaned]));

    const histRaw = await AsyncStorage.getItem('@meridian:score_history').catch(() => null);
    const hist = histRaw ? JSON.parse(histRaw) : [];
    const cleanedHist = hist.filter((h: any) => h.date !== yesterdayKey);
    await AsyncStorage.setItem('@meridian:score_history', JSON.stringify([
      { date: yesterdayKey, score: 94, locked: true },
      ...cleanedHist,
    ]));
  } else {
    // Rough Yesterday: score 41, gym and deep work skipped
    const resolutions = yesterdayBlocks.map((b) => {
      const isSkipped = b.category === 'training' || b.category === 'work';
      return {
        blockId: b.id,
        date: yesterdayKey,
        status: isSkipped ? ('skipped' as const) : ('done' as const),
        outcome: { rating: isSkipped ? 1 : 3, note: 'Got derailed by a long call, felt sluggish.' },
        resolvedAt: new Date().toISOString(),
      };
    });
    const raw = await AsyncStorage.getItem('@meridian:resolutions').catch(() => null);
    const existing = raw ? JSON.parse(raw) : [];
    const cleaned = existing.filter((r: any) => r.date !== yesterdayKey);
    await AsyncStorage.setItem('@meridian:resolutions', JSON.stringify([...resolutions, ...cleaned]));

    const histRaw = await AsyncStorage.getItem('@meridian:score_history').catch(() => null);
    const hist = histRaw ? JSON.parse(histRaw) : [];
    const cleanedHist = hist.filter((h: any) => h.date !== yesterdayKey);
    await AsyncStorage.setItem('@meridian:score_history', JSON.stringify([
      { date: yesterdayKey, score: 41, locked: true },
      ...cleanedHist,
    ]));
  }

  // Reload stores to pick up new data
  await useResolutionStore.getState().load();
  await perf.load();
  console.log(`[Dev] Seeded scenario ${scenario} for ${yesterdayKey}`);
}
