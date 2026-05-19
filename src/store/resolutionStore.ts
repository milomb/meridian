import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ResolutionStatus = 'done' | 'skipped';

export interface EventOutcome {
  rating: number | null;
  note: string | null;
}

export interface BlockResolution {
  blockId: string;
  date: string; // YYYY-MM-DD
  status: ResolutionStatus;
  outcome: EventOutcome;
  resolvedAt: string; // ISO timestamp
}

interface ResolutionStore {
  resolutions: BlockResolution[];
  loaded: boolean;
  // pending auto-open: set when tapping unresolved banner to deep-link into resolve sheet
  pendingBlockId: string | null;
  pendingDate: string | null;
  load: () => Promise<void>;
  resolveBlock: (blockId: string, date: string, status: ResolutionStatus, outcome?: EventOutcome) => void;
  unresolveBlock: (blockId: string, date: string) => void;
  getResolution: (blockId: string, date: string) => BlockResolution | undefined;
  setPending: (blockId: string, date: string) => void;
  clearPending: () => void;
}

const STORAGE_KEY = '@meridian:resolutions';

export const useResolutionStore = create<ResolutionStore>((set, get) => ({
  resolutions: [],
  loaded: false,
  pendingBlockId: null,
  pendingDate: null,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const resolutions: BlockResolution[] = raw ? JSON.parse(raw) : [];
      set({ resolutions, loaded: true });
    } catch {
      set({ resolutions: [], loaded: true });
    }
  },

  resolveBlock: (blockId, date, status, outcome) => {
    const resolution: BlockResolution = {
      blockId,
      date,
      status,
      outcome: outcome ?? { rating: null, note: null },
      resolvedAt: new Date().toISOString(),
    };
    const resolutions = [
      resolution,
      ...get().resolutions.filter((r) => !(r.blockId === blockId && r.date === date)),
    ].slice(0, 500); // cap at 500 entries (~50 days of 10 blocks)
    set({ resolutions });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resolutions));
  },

  unresolveBlock: (blockId, date) => {
    const resolutions = get().resolutions.filter(
      (r) => !(r.blockId === blockId && r.date === date),
    );
    set({ resolutions });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resolutions));
  },

  getResolution: (blockId, date) =>
    get().resolutions.find((r) => r.blockId === blockId && r.date === date),

  setPending: (blockId, date) => set({ pendingBlockId: blockId, pendingDate: date }),
  clearPending: () => set({ pendingBlockId: null, pendingDate: null }),
}));
