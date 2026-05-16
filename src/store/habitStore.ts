import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  frequency: HabitFrequency;
  customDays?: number[]; // 0=Sun … 6=Sat
  completedDates: string[]; // "YYYY-MM-DD"
  streak: number;
  createdAt: string;
}

const STORAGE_KEY = '@meridian:habits';

const DEFAULT_HABITS: Habit[] = [
  {
    id: '1',
    name: 'Morning Workout',
    emoji: '💪',
    frequency: 'weekdays',
    completedDates: [],
    streak: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Read 30 min',
    emoji: '📖',
    frequency: 'daily',
    completedDates: [],
    streak: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Meditate',
    emoji: '🧘',
    frequency: 'daily',
    completedDates: [],
    streak: 0,
    createdAt: new Date().toISOString(),
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isScheduledToday(habit: Habit): boolean {
  const day = new Date().getDay();
  switch (habit.frequency) {
    case 'daily': return true;
    case 'weekdays': return day >= 1 && day <= 5;
    case 'weekends': return day === 0 || day === 6;
    case 'custom': return habit.customDays?.includes(day) ?? false;
  }
}

function computeStreak(completedDates: string[]): number {
  if (!completedDates.length) return 0;
  const sorted = [...completedDates].sort().reverse();
  const today = todayStr();
  let streak = 0;
  let check = new Date(today);
  for (const d of sorted) {
    const checkStr = check.toISOString().slice(0, 10);
    if (d === checkStr) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

interface HabitStore {
  habits: Habit[];
  loaded: boolean;
  load: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'completedDates' | 'streak' | 'createdAt'>) => void;
  toggleToday: (id: string) => void;
  deleteHabit: (id: string) => void;
  isCompletedToday: (habit: Habit) => boolean;
  isScheduledToday: (habit: Habit) => boolean;
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const habits = raw ? JSON.parse(raw) : DEFAULT_HABITS;
      set({ habits, loaded: true });
    } catch {
      set({ habits: DEFAULT_HABITS, loaded: true });
    }
  },

  addHabit: (habit) => {
    const newHabit: Habit = {
      ...habit,
      id: Date.now().toString(),
      completedDates: [],
      streak: 0,
      createdAt: new Date().toISOString(),
    };
    const habits = [...get().habits, newHabit];
    set({ habits });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  },

  toggleToday: (id) => {
    const today = todayStr();
    const habits = get().habits.map((h) => {
      if (h.id !== id) return h;
      const alreadyDone = h.completedDates.includes(today);
      const completedDates = alreadyDone
        ? h.completedDates.filter((d) => d !== today)
        : [...h.completedDates, today];
      return { ...h, completedDates, streak: computeStreak(completedDates) };
    });
    set({ habits });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  },

  deleteHabit: (id) => {
    const habits = get().habits.filter((h) => h.id !== id);
    set({ habits });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  },

  isCompletedToday: (habit) => habit.completedDates.includes(todayStr()),
  isScheduledToday,
}));
