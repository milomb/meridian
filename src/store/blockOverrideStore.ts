import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BlockOverride {
  blockId: string;
  date: string;          // YYYY-MM-DD
  originalStart: string; // HH:MM
  originalEnd: string;
  overrideStart: string;
  overrideEnd: string;
}

interface BlockOverrideStore {
  overrides: BlockOverride[];
  loaded: boolean;
  load: () => Promise<void>;
  setOverride: (override: BlockOverride) => void;
  getOverride: (blockId: string, date: string) => BlockOverride | undefined;
}

const STORAGE_KEY = '@meridian:blockOverrides';

export const useBlockOverrideStore = create<BlockOverrideStore>((set, get) => ({
  overrides: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({ overrides: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ overrides: [], loaded: true });
    }
  },

  setOverride: (override) => {
    const overrides = [
      override,
      ...get().overrides.filter(
        (o) => !(o.blockId === override.blockId && o.date === override.date),
      ),
    ];
    set({ overrides });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  },

  getOverride: (blockId, date) =>
    get().overrides.find((o) => o.blockId === blockId && o.date === date),
}));
