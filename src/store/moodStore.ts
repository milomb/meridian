import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: MoodLevel;
  note: string;
  createdAt: string;
}

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😊',
};

export const MOOD_LABEL: Record<MoodLevel, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

export const MOOD_COLOR: Record<MoodLevel, string> = {
  1: '#E05C5C',
  2: '#D4A574',
  3: '#8A857E',
  4: '#6DB87A',
  5: '#3EB87A',
};

const STORAGE_KEY = '@meridian:mood';

interface MoodStore {
  entries: MoodEntry[];
  loaded: boolean;
  load: () => Promise<void>;
  saveEntry: (date: string, mood: MoodLevel, note: string) => void;
  deleteEntry: (id: string) => void;
  getEntryForDate: (date: string) => MoodEntry | undefined;
}

export const useMoodStore = create<MoodStore>((set, get) => ({
  entries: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({ entries: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ entries: [], loaded: true });
    }
  },

  saveEntry: (date, mood, note) => {
    const existing = get().entries.find((e) => e.date === date);
    let entries: MoodEntry[];
    if (existing) {
      entries = get().entries.map((e) =>
        e.date === date ? { ...e, mood, note } : e
      );
    } else {
      const newEntry: MoodEntry = {
        id: Date.now().toString(),
        date,
        mood,
        note,
        createdAt: new Date().toISOString(),
      };
      entries = [newEntry, ...get().entries];
    }
    set({ entries });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  deleteEntry: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  },

  getEntryForDate: (date) => get().entries.find((e) => e.date === date),
}));
