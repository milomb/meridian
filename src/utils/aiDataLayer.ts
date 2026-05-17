import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_KEY = '@meridian:ai:userProfile';
const DAILY_SUMMARY_KEY = '@meridian:ai:dailySummary';

const DEFAULT_USER_PROFILE = {
  name: '',
  goals: [],
  patterns: [],
  preferences: {},
  lastUpdated: null,
};

const DEFAULT_DAILY_SUMMARY = {
  date: null,
  score: null,
  protocolsHit: null,
  blocksResolved: null,
  blocksSkipped: null,
  sleep: null,
  steps: null,
  readiness: null,
  outcomes: [],
  notes: '',
};

export async function initAIDataLayer(): Promise<void> {
  try {
    const [profile, summary] = await Promise.all([
      AsyncStorage.getItem(USER_PROFILE_KEY),
      AsyncStorage.getItem(DAILY_SUMMARY_KEY),
    ]);
    await Promise.all([
      profile ? null : AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(DEFAULT_USER_PROFILE)),
      summary ? null : AsyncStorage.setItem(DAILY_SUMMARY_KEY, JSON.stringify(DEFAULT_DAILY_SUMMARY)),
    ]);
  } catch {}
}
