import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { useNotesStore, Note, NoteTag } from '../../src/store/notesStore';

const TAGS: NoteTag[] = ['work', 'training', 'personal', 'idea', 'plan', 'reflection'];

const TAG_COLORS: Record<NoteTag, string> = {
  work: colors.categories.work,
  training: colors.categories.training,
  personal: colors.categories.personal,
  idea: '#F0C040',
  plan: colors.categories.learning,
  reflection: colors.categories.rest,
};

function NoteCard({ note, onPress, onLongPress }: { note: Note; onPress: () => void; onLongPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={styles.card} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        {note.pinned && <Text style={styles.pin}>📌</Text>}
        <Text style={styles.cardTitle} numberOfLines={1}>{note.title || 'Untitled'}</Text>
      </View>
      <Text style={styles.cardPreview} numberOfLines={2}>{note.content}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.cardTags}>
          {note.tags.slice(0, 3).map((t) => (
            <View key={t} style={[styles.tagChip, { borderColor: TAG_COLORS[t] + '60' }]}>
              <Text style={[styles.tagChipText, { color: TAG_COLORS[t] }]}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.cardDate}>
          {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface EditorState {
  title: string;
  content: string;
  tags: NoteTag[];
}

export default function NotesScreen() {
  const { load, filteredNotes, searchQuery, setSearchQuery, addNote, updateNote, deleteNote, togglePin } =
    useNotesStore();
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ title: '', content: '', tags: [] });

  useEffect(() => { load(); }, []);

  const notes = filteredNotes();

  const openNew = () => {
    setEditor({ title: '', content: '', tags: [] });
    setEditingId(null);
    setEditorVisible(true);
  };

  const openNote = (note: Note) => {
    setEditor({ title: note.title, content: note.content, tags: note.tags });
    setEditingId(note.id);
    setEditorVisible(true);
  };

  const handleSave = () => {
    if (!editor.title.trim() && !editor.content.trim()) {
      setEditorVisible(false);
      return;
    }
    if (editingId) {
      updateNote(editingId, { title: editor.title, content: editor.content, tags: editor.tags });
    } else {
      addNote({ title: editor.title, content: editor.content, tags: editor.tags, pinned: false });
    }
    setEditorVisible(false);
  };

  const handleLongPress = (note: Note) => {
    Alert.alert(note.title || 'Note', 'Options', [
      { text: 'Cancel', style: 'cancel' },
      { text: note.pinned ? 'Unpin' : 'Pin', onPress: () => togglePin(note.id) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(note.id) },
    ]);
  };

  const toggleTag = (tag: NoteTag) => {
    setEditor((e) => ({
      ...e,
      tags: e.tags.includes(tag) ? e.tags.filter((t) => t !== tag) : [...e.tags, tag],
    }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
        <TouchableOpacity onPress={openNew} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes…"
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{searchQuery ? 'No results' : 'No notes yet'}</Text>
          </View>
        )}
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} onPress={() => openNote(n)} onLongPress={() => handleLongPress(n)} />
        ))}
      </ScrollView>

      {/* Full-screen editor */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle="fullScreen">
        <KeyboardAvoidingView
          style={styles.editorContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.editorSafe} edges={['top', 'bottom']}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={() => setEditorVisible(false)}>
                <Text style={styles.editorCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.editorSave}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Tag bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagBar}>
              {TAGS.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => toggleTag(t)}
                  style={[
                    styles.editorTag,
                    editor.tags.includes(t) && {
                      backgroundColor: TAG_COLORS[t] + '20',
                      borderColor: TAG_COLORS[t],
                    },
                  ]}
                >
                  <Text style={[styles.editorTagText, editor.tags.includes(t) && { color: TAG_COLORS[t] }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.editorTitle}
              value={editor.title}
              onChangeText={(t) => setEditor((e) => ({ ...e, title: t }))}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              multiline={false}
            />
            <TextInput
              style={styles.editorBody}
              value={editor.content}
              onChangeText={(t) => setEditor((e) => ({ ...e, content: t }))}
              placeholder="Start writing…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              autoFocus={!editingId}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primaryFaint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + '60',
  },
  addBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  clearSearch: { color: colors.textMuted, fontSize: 16, padding: 4 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pin: { fontSize: 14 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  cardPreview: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTags: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  tagChip: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipText: { fontSize: 11, fontWeight: '600' },
  cardDate: { color: colors.textMuted, fontSize: 11 },
  // Editor
  editorContainer: { flex: 1, backgroundColor: colors.bg },
  editorSafe: { flex: 1 },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorCancel: { color: colors.textSecondary, fontSize: 16 },
  editorSave: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  tagBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  editorTag: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  editorTagText: { color: colors.textSecondary, fontSize: 13, textTransform: 'capitalize' },
  editorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorBody: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
  },
});
