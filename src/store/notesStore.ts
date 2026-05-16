import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NoteTag = 'work' | 'training' | 'personal' | 'idea' | 'plan' | 'reflection';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: NoteTag[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = '@meridian:notes';

interface NotesStore {
  notes: Note[];
  loaded: boolean;
  searchQuery: string;
  load: () => Promise<void>;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  setSearchQuery: (q: string) => void;
  filteredNotes: () => Note[];
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  loaded: false,
  searchQuery: '',

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const notes = raw ? JSON.parse(raw) : [];
      set({ notes, loaded: true });
    } catch {
      set({ notes: [], loaded: true });
    }
  },

  addNote: (note) => {
    const id = Date.now().toString();
    const now = new Date().toISOString();
    const newNote: Note = { ...note, id, createdAt: now, updatedAt: now };
    const notes = [newNote, ...get().notes];
    set({ notes });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return id;
  },

  updateNote: (id, updates) => {
    const notes = get().notes.map((n) =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );
    set({ notes });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },

  deleteNote: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    set({ notes });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },

  togglePin: (id) => {
    const notes = get().notes.map((n) =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
    );
    set({ notes });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  filteredNotes: () => {
    const { notes, searchQuery } = get();
    const q = searchQuery.toLowerCase().trim();
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q))
    );
  },
}));
