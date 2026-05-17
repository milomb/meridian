import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalEvent {
  id: string;
  title: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:MM, empty string if all-day
  endTime: string;   // HH:MM, empty string if all-day
  isAllDay: boolean;
  color: string;     // hex
  notes: string;
}

interface LocalEventStore {
  events: LocalEvent[];
  loaded: boolean;
  load: () => Promise<void>;
  addEvent: (e: Omit<LocalEvent, 'id'>) => void;
  deleteEvent: (id: string) => void;
}

const KEY = '@meridian:local_events';

export const useLocalEventStore = create<LocalEventStore>((set, get) => ({
  events: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ events: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addEvent: (e) => {
    const id = Date.now().toString();
    const events = [...get().events, { ...e, id }];
    set({ events });
    AsyncStorage.setItem(KEY, JSON.stringify(events));
  },

  deleteEvent: (id) => {
    const events = get().events.filter((e) => e.id !== id);
    set({ events });
    AsyncStorage.setItem(KEY, JSON.stringify(events));
  },
}));
