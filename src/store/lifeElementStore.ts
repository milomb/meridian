import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeBlock } from './scheduleStore';

export interface LifeElement {
  id: string;
  name: string;
  emoji: string;
  status: string;
  color: string;
  bg: string;
}

export const DEFAULT_ELEMENTS: LifeElement[] = [
  { id: 'work', name: 'Work', emoji: '💼', status: '', color: '#5B8FD4', bg: '#1A2A3A' },
  { id: 'training', name: 'Training', emoji: '🏋️', status: '', color: '#6DB87A', bg: '#1A2A1E' },
  { id: 'learning', name: 'Learning', emoji: '📚', status: '', color: '#5BD4C8', bg: '#1A2A2A' },
  { id: 'personal', name: 'Personal', emoji: '🧘', status: '', color: '#D4A574', bg: '#2A1E10' },
  { id: 'nutrition', name: 'Nutrition', emoji: '🥗', status: '', color: '#D47A5B', bg: '#2A1E18' },
  { id: 'rest', name: 'Rest', emoji: '😴', status: '', color: '#9B8FD4', bg: '#231E2A' },
];

const STORAGE_KEY = '@meridian:life_elements';

interface LifeElementStore {
  elements: LifeElement[];
  loaded: boolean;
  load: () => Promise<void>;
  addElement: (el: Omit<LifeElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<Omit<LifeElement, 'id'>>) => void;
  deleteElement: (id: string) => void;
}

export const useLifeElementStore = create<LifeElementStore>((set, get) => ({
  elements: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const elements: LifeElement[] = raw ? JSON.parse(raw) : DEFAULT_ELEMENTS;
      set({ elements, loaded: true });
    } catch {
      set({ elements: DEFAULT_ELEMENTS, loaded: true });
    }
  },

  addElement: (el) => {
    const id = Date.now().toString();
    const elements = [...get().elements, { ...el, id }];
    set({ elements });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },

  updateElement: (id, updates) => {
    const elements = get().elements.map((el) => el.id === id ? { ...el, ...updates } : el);
    set({ elements });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },

  deleteElement: (id) => {
    const elements = get().elements.filter((el) => el.id !== id);
    set({ elements });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  },
}));

export function computeWeeklyMinutes(elementName: string, blocks: TimeBlock[]): number {
  const key = elementName.toLowerCase();
  return blocks
    .filter((b) => b.category.toLowerCase() === key)
    .reduce((total, b) => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      const dur = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      return total + b.daysOfWeek.length * dur;
    }, 0);
}

export function fmtWeeklyTime(mins: number): string {
  if (mins === 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
