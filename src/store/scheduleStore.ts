import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeBlock {
  id: string;
  title: string;
  description: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  category: string;
  daysOfWeek: DayOfWeek[];
  isFixed: boolean;
  reminder: boolean;
}

const DEFAULT_BLOCKS: TimeBlock[] = [
  {
    id: '1',
    title: 'Morning Training',
    description: '',
    startTime: '06:00',
    endTime: '07:30',
    category: 'training',
    daysOfWeek: [1, 2, 3, 4, 5],
    isFixed: true,
    reminder: true,
  },
  {
    id: '2',
    title: 'Deep Work',
    description: '',
    startTime: '09:00',
    endTime: '12:00',
    category: 'work',
    daysOfWeek: [1, 2, 3, 4, 5],
    isFixed: true,
    reminder: true,
  },
  {
    id: '3',
    title: 'Lunch & Nutrition',
    description: '',
    startTime: '12:00',
    endTime: '13:00',
    category: 'nutrition',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isFixed: false,
    reminder: false,
  },
  {
    id: '4',
    title: 'Learning Block',
    description: '',
    startTime: '14:00',
    endTime: '15:30',
    category: 'learning',
    daysOfWeek: [1, 2, 3, 4, 5],
    isFixed: false,
    reminder: true,
  },
  {
    id: '5',
    title: 'Personal Time',
    description: '',
    startTime: '18:00',
    endTime: '20:00',
    category: 'personal',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isFixed: false,
    reminder: false,
  },
  {
    id: '6',
    title: 'Wind Down',
    description: '',
    startTime: '21:30',
    endTime: '22:30',
    category: 'rest',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isFixed: false,
    reminder: true,
  },
];

const STORAGE_KEY = '@meridian:schedule';

interface ScheduleStore {
  blocks: TimeBlock[];
  loaded: boolean;
  load: () => Promise<void>;
  addBlock: (block: Omit<TimeBlock, 'id'>) => void;
  updateBlock: (id: string, updates: Partial<TimeBlock>) => void;
  deleteBlock: (id: string) => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  blocks: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const blocks = raw ? JSON.parse(raw) : DEFAULT_BLOCKS;
      // Backfill description for blocks loaded before it was added
      const migrated = blocks.map((b: TimeBlock) => ({
        ...b,
        description: b.description ?? '',
      }));
      set({ blocks: migrated, loaded: true });
    } catch {
      set({ blocks: DEFAULT_BLOCKS, loaded: true });
    }
  },

  addBlock: (block) => {
    const id = Date.now().toString();
    const blocks = [...get().blocks, { ...block, id }];
    set({ blocks });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  },

  updateBlock: (id, updates) => {
    const blocks = get().blocks.map((b) => (b.id === id ? { ...b, ...updates } : b));
    set({ blocks });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  },

  deleteBlock: (id) => {
    const blocks = get().blocks.filter((b) => b.id !== id);
    set({ blocks });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  },
}));

export function getTodayBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const day = new Date().getDay() as DayOfWeek;
  return blocks
    .filter((b) => b.daysOfWeek.includes(day))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getBlocksForDay(blocks: TimeBlock[], day: DayOfWeek): TimeBlock[] {
  return blocks
    .filter((b) => b.daysOfWeek.includes(day))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function getCurrentBlock(blocks: TimeBlock[]): TimeBlock | null {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayBlocks = getTodayBlocks(blocks);
  return todayBlocks.find((b) => b.startTime <= hhmm && hhmm < b.endTime) ?? null;
}

export function getUpcomingBlocks(blocks: TimeBlock[], limit = 3): TimeBlock[] {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayBlocks = getTodayBlocks(blocks);
  return todayBlocks.filter((b) => b.startTime > hhmm).slice(0, limit);
}

export function blockProgressPercent(block: TimeBlock): number {
  const now = new Date();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(block.startTime);
  const end = toMinutes(block.endTime);
  if (end === start) return 0;
  return Math.min(1, Math.max(0, (current - start) / (end - start)));
}
