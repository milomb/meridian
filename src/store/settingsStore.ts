import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeKey } from '../theme/themes';
import { AIProvider } from '../utils/ai';

export interface CustomCategory {
  id: string;
  name: string;
  color: string;
  bg: string;
}

export type WeekStartDay = 'sunday' | 'monday';

export type WeeklyAverageMode = 'rolling' | 'calendar';

interface SettingsState {
  userName: string;
  apiKey: string;
  groqApiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  provider: AIProvider;
  theme: ThemeKey;
  weekStartDay: WeekStartDay;
  customCategories: CustomCategory[];
  stepGoal: number;
  sleepTarget: number;
  weeklyAverageMode: WeeklyAverageMode;
  loaded: boolean;
}

interface SettingsStore extends SettingsState {
  load: () => Promise<void>;
  setUserName: (name: string) => void;
  setApiKey: (key: string) => void;
  setGroqApiKey: (key: string) => void;
  setOllamaUrl: (url: string) => void;
  setOllamaModel: (model: string) => void;
  setProvider: (p: AIProvider) => void;
  setTheme: (theme: ThemeKey) => void;
  setWeekStartDay: (d: WeekStartDay) => void;
  setStepGoal: (goal: number) => void;
  setSleepTarget: (hrs: number) => void;
  setWeeklyAverageMode: (mode: WeeklyAverageMode) => void;
  addCustomCategory: (cat: Omit<CustomCategory, 'id'>) => void;
  updateCustomCategory: (id: string, updates: Partial<Omit<CustomCategory, 'id'>>) => void;
  deleteCustomCategory: (id: string) => void;
}

const STORAGE_KEY = '@meridian:settings_v2';

function persistState(state: SettingsState) {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      userName: state.userName,
      apiKey: state.apiKey,
      groqApiKey: state.groqApiKey,
      ollamaUrl: state.ollamaUrl,
      ollamaModel: state.ollamaModel,
      provider: state.provider,
      theme: state.theme,
      weekStartDay: state.weekStartDay,
      customCategories: state.customCategories,
      stepGoal: state.stepGoal,
      sleepTarget: state.sleepTarget,
      weeklyAverageMode: state.weeklyAverageMode,
    })
  );
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  userName: '',
  apiKey: '',
  groqApiKey: '',
  ollamaUrl: '',
  ollamaModel: 'llama3.2',
  provider: 'groq',
  theme: 'dusk',
  weekStartDay: 'monday',
  customCategories: [],
  stepGoal: 10000,
  sleepTarget: 8,
  weeklyAverageMode: 'rolling',
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          ...saved,
          provider: saved.provider ?? 'groq',
          stepGoal: saved.stepGoal ?? 10000,
          sleepTarget: saved.sleepTarget ?? 8,
          weeklyAverageMode: saved.weeklyAverageMode ?? 'rolling',
          loaded: true,
        });
      } else {
        const oldKey = await AsyncStorage.getItem('@meridian:anthropic_key');
        set({ apiKey: oldKey ?? '', provider: oldKey ? 'anthropic' : 'groq', loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setStepGoal: (stepGoal) => { set({ stepGoal }); persistState(get()); },
  setSleepTarget: (sleepTarget) => { set({ sleepTarget }); persistState(get()); },
  setWeeklyAverageMode: (weeklyAverageMode) => { set({ weeklyAverageMode }); persistState(get()); },
  setUserName: (userName) => { set({ userName }); persistState(get()); },
  setApiKey: (apiKey) => { set({ apiKey }); persistState(get()); },
  setGroqApiKey: (groqApiKey) => { set({ groqApiKey }); persistState(get()); },
  setOllamaUrl: (ollamaUrl) => { set({ ollamaUrl }); persistState(get()); },
  setOllamaModel: (ollamaModel) => { set({ ollamaModel }); persistState(get()); },
  setProvider: (provider) => { set({ provider }); persistState(get()); },
  setTheme: (theme) => { set({ theme }); persistState(get()); },
  setWeekStartDay: (weekStartDay) => { set({ weekStartDay }); persistState(get()); },

  addCustomCategory: (cat) => {
    const id = Date.now().toString();
    const customCategories = [...get().customCategories, { ...cat, id }];
    set({ customCategories });
    persistState(get());
  },

  updateCustomCategory: (id, updates) => {
    const customCategories = get().customCategories.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    set({ customCategories });
    persistState(get());
  },

  deleteCustomCategory: (id) => {
    const customCategories = get().customCategories.filter((c) => c.id !== id);
    set({ customCategories });
    persistState(get());
  },
}));
