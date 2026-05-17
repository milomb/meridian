import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../src/theme/colors';
import { useNotesStore, Note, NoteTag } from '../../src/store/notesStore';

const TAGS: NoteTag[] = ['work', 'training', 'personal', 'idea', 'plan', 'reflection'];

const TAG_COLORS: Record<NoteTag, string> = {
  work: '#5B8FD4',
  training: '#6DB87A',
  personal: '#D4A574',
  idea: '#F0C040',
  plan: '#5BD4C8',
  reflection: '#9B8FD4',
};

function NoteCard({ note, onPress, onDelete }: {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onDelete}
      style={{
        backgroundColor: c.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: c.border,
      }}
      activeOpacity={0.75}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {note.pinned && <Text style={{ fontSize: 14 }}>📌</Text>}
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '500', flex: 1 }} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '400' }}>
          {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10, fontWeight: '400' }} numberOfLines={2}>
        {note.content}
      </Text>
      {note.tags.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {note.tags.slice(0, 3).map((t) => (
            <View key={t} style={{
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: TAG_COLORS[t] + '60',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '500', color: TAG_COLORS[t] }}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

interface EditorState {
  title: string;
  content: string;
  tags: NoteTag[];
}

export default function NotesScreen() {
  const c = useColors();
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

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Note', `Delete "${title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteNote(id); setEditorVisible(false); } },
    ]);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
      >
        <Ionicons name="chevron-back" size={20} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: '400' }}>Back</Text>
      </TouchableOpacity>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 8,
      }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '600' }}>Notes</Text>
        <TouchableOpacity
          onPress={openNew}
          style={{
            backgroundColor: c.primaryFaint,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: c.primary + '60',
          }}
        >
          <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        borderRadius: 12,
        marginHorizontal: 20,
        marginBottom: 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.border,
        gap: 8,
      }}>
        <Text style={{ fontSize: 14 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, color: c.text, fontSize: 14, paddingVertical: 12, fontWeight: '400' }}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes…"
          placeholderTextColor={c.textMuted}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: c.textMuted, fontSize: 16, padding: 4 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {notes.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: c.textMuted, fontSize: 15, fontWeight: '400' }}>
              {searchQuery ? 'No results' : 'No notes yet'}
            </Text>
          </View>
        )}
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            onPress={() => openNote(n)}
            onDelete={() => handleLongPress(n)}
          />
        ))}
      </ScrollView>

      {/* Full-screen editor */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle="fullScreen">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: c.bg }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* Editor header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}>
              <TouchableOpacity onPress={() => setEditorVisible(false)}>
                <Text style={{ color: c.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                {editingId && (
                  <TouchableOpacity onPress={() => handleDelete(editingId, editor.title)}>
                    <Text style={{ color: c.error, fontSize: 14, fontWeight: '500' }}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSave}>
                  <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tag bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 52, borderBottomWidth: 1, borderBottomColor: c.border }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 8, flexDirection: 'row' }}
            >
              {TAGS.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => toggleTag(t)}
                  style={{
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: editor.tags.includes(t) ? TAG_COLORS[t] : c.border,
                    backgroundColor: editor.tags.includes(t) ? TAG_COLORS[t] + '20' : c.surface,
                  }}
                >
                  <Text style={{
                    color: editor.tags.includes(t) ? TAG_COLORS[t] : c.textSecondary,
                    fontSize: 12,
                    textTransform: 'capitalize',
                    fontWeight: '400',
                  }}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={{
                color: c.text,
                fontSize: 21,
                fontWeight: '600',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
              value={editor.title}
              onChangeText={(t) => setEditor((e) => ({ ...e, title: t }))}
              placeholder="Title"
              placeholderTextColor={c.textMuted}
            />
            <TextInput
              style={{
                flex: 1,
                color: c.text,
                fontSize: 15,
                lineHeight: 24,
                padding: 20,
                fontWeight: '400',
              }}
              value={editor.content}
              onChangeText={(t) => setEditor((e) => ({ ...e, content: t }))}
              placeholder="Start writing…"
              placeholderTextColor={c.textMuted}
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
