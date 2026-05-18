import React, { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendAIMessage } from '../../src/utils/ai';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../src/theme/colors';
import { useSettingsStore } from '../../src/store/settingsStore';
import { THEMES, THEME_NAMES, ThemeKey } from '../../src/theme/themes';
import { useJarvisStore, buildJarvisStateJson, __seedDevState } from '../../src/store/jarvisStore';
import { sendToJarvis } from '../../src/services/groqApi';

const PRESET_COLORS = [
  { color: '#E05C5C', bg: '#3A1A1A', label: 'Red' },
  { color: '#E08C5C', bg: '#3A2010', label: 'Orange' },
  { color: '#D4A574', bg: '#3A2A1A', label: 'Amber' },
  { color: '#D4D45C', bg: '#2A2A10', label: 'Yellow' },
  { color: '#6DB87A', bg: '#1A2A1E', label: 'Green' },
  { color: '#5BD4C8', bg: '#1A2A2A', label: 'Teal' },
  { color: '#5B8FD4', bg: '#1A2A3A', label: 'Blue' },
  { color: '#A78BFA', bg: '#2A1F40', label: 'Violet' },
  { color: '#D47AB8', bg: '#3A1A2A', label: 'Pink' },
  { color: '#8FD45B', bg: '#1E2A10', label: 'Lime' },
];

const THEME_PREVIEWS: Record<ThemeKey, { bg: string; surface: string; primary: string }> = {
  dusk: { bg: '#0D0C0B', surface: '#1A1917', primary: '#D4A574' },
  midnight: { bg: '#080C14', surface: '#111827', primary: '#6B9FE4' },
  slate: { bg: '#0F1117', surface: '#1C1F28', primary: '#A78BFA' },
  light: { bg: '#F7F6F4', surface: '#FFFFFF', primary: '#B07840' },
};

export default function SettingsScreen() {
  const c = useColors();
  const {
    userName, apiKey, groqApiKey, ollamaUrl, ollamaModel, provider, theme, weekStartDay, customCategories,
    setUserName, setApiKey, setGroqApiKey, setOllamaUrl, setOllamaModel, setProvider, setTheme, setWeekStartDay,
    addCustomCategory, deleteCustomCategory,
  } = useSettingsStore();

  const [nameInput, setNameInput] = useState(userName);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [groqKeyInput, setGroqKeyInput] = useState(groqApiKey);
  const [ollamaUrlInput, setOllamaUrlInput] = useState(ollamaUrl);
  const [ollamaModelInput, setOllamaModelInput] = useState(ollamaModel || 'llama3.2');
  const [showKey, setShowKey] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(PRESET_COLORS[5].color);
  const [catBg, setCatBg] = useState(PRESET_COLORS[5].bg);

  const [testing, setTesting] = useState(false);
  const [triggeringBriefing, setTriggeringBriefing] = useState(false);
  const { clearBriefingFlag, markBriefingRanToday, setBriefingText, setBriefingLoading, setBriefingBannerVisible } = useJarvisStore();

  const saveProfile = () => {
    setUserName(nameInput.trim());
    setApiKey(keyInput.trim());
    setGroqApiKey(groqKeyInput.trim());
    setOllamaUrl(ollamaUrlInput.trim());
    setOllamaModel(ollamaModelInput.trim() || 'llama3.2');
    Alert.alert('Saved', 'Settings updated.');
  };

  const testConnection = async () => {
    const key = provider === 'groq' ? groqKeyInput.trim() : provider === 'ollama' ? ollamaUrlInput.trim() : keyInput.trim();
    if (!key) {
      Alert.alert('No key/URL', `Enter ${provider === 'ollama' ? 'the Ollama URL' : 'an API key'} first.`);
      return;
    }
    setTesting(true);
    try {
      const reply = await sendAIMessage(
        [{ role: 'user', content: 'Reply with exactly two words: connection ok' }],
        'You are a connection test. Reply with exactly two words: connection ok',
        provider,
        keyInput.trim(),
        groqKeyInput.trim(),
        20,
        ollamaUrlInput.trim(),
        ollamaModelInput.trim() || 'llama3.2',
      );
      const label = provider === 'groq' ? 'Groq · Llama 3.3' : provider === 'ollama' ? `Ollama · ${ollamaModelInput.trim() || 'llama3.2'}` : 'Anthropic · Claude';
      Alert.alert('Connection OK ✓', `${label}\n\n"${reply.trim()}"`);
    } catch (err: any) {
      Alert.alert('Connection failed', err.message ?? 'Unknown error');
    } finally {
      setTesting(false);
    }
  };

  const addCat = () => {
    if (!catName.trim()) return;
    addCustomCategory({ name: catName.trim(), color: catColor, bg: catBg });
    setCatName('');
    setCatModalVisible(false);
  };

  const triggerBriefing = async () => {
    if (!groqApiKey) {
      Alert.alert('Groq API key required', 'Add a Groq key above first.');
      return;
    }
    setTriggeringBriefing(true);
    try {
      await clearBriefingFlag();
      setBriefingText(null);
      setBriefingBannerVisible(false);
      setBriefingLoading(true);
      const stateJson = buildJarvisStateJson();
      const response = await sendToJarvis(groqApiKey, [{ role: 'user', content: '[TRIGGER_MORNING_BRIEFING]' }], stateJson);
      await markBriefingRanToday();
      setBriefingText(response.jarvis_speech);
      setBriefingBannerVisible(true);
      setBriefingLoading(false);
      Alert.alert('Briefing triggered', 'Go to the Home tab — the briefing banner will appear.');
    } catch (err: any) {
      setBriefingLoading(false);
      Alert.alert('Briefing failed', err.message ?? 'Unknown error');
    } finally {
      setTriggeringBriefing(false);
    }
  };

  const confirmDeleteCat = (id: string, name: string) => {
    Alert.alert('Delete Category', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCustomCategory(id) },
    ]);
  };

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    header: { marginBottom: 28 },
    title: { color: c.text, fontSize: 28, fontWeight: '600' },
    section: { marginBottom: 28 },
    sectionLabel: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      color: c.text,
      fontSize: 15,
      marginBottom: 10,
      fontWeight: '400',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    keyInput: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      color: c.text,
      fontSize: 15,
      fontWeight: '400',
    },
    showBtn: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    showBtnText: { color: c.textSecondary, fontSize: 13 },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    saveBtnText: { color: c.isDark ? c.bg : '#fff', fontSize: 15, fontWeight: '600' },
    themeRow: { flexDirection: 'row', gap: 10 },
    themeCard: {
      flex: 1,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      gap: 6,
    },
    themeCardSelected: { borderColor: c.primary },
    themePreview: {
      width: 40,
      height: 28,
      borderRadius: 8,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    themePreviewBg: { flex: 1 },
    themePreviewSurface: { flex: 1 },
    themePreviewAccent: { width: 6, borderRadius: 3 },
    themeLabel: { fontSize: 11, fontWeight: '500' },
    catList: { gap: 8 },
    catItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    catDot: { width: 14, height: 14, borderRadius: 7 },
    catName: { flex: 1, color: c.text, fontSize: 14, fontWeight: '400' },
    catDelete: { color: c.error, fontSize: 20, lineHeight: 22, paddingHorizontal: 4 },
    addCatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      gap: 6,
      marginTop: 8,
    },
    addCatText: { color: c.primary, fontSize: 14, fontWeight: '500' },
    modal: { flex: 1, backgroundColor: c.bg },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      paddingTop: 60,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: { color: c.text, fontSize: 17, fontWeight: '600' },
    modalCancel: { color: c.textSecondary, fontSize: 16 },
    modalSave: { color: c.primary, fontSize: 16, fontWeight: '600' },
    modalContent: { padding: 20, paddingBottom: 60 },
    fieldLabel: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginTop: 20,
    },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorSwatch: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: c.text,
    },
    hintText: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 6,
      lineHeight: 18,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
      >
        <Ionicons name="chevron-back" size={20} color={c.primary} />
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: '400' }}>Back</Text>
      </TouchableOpacity>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* Profile */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Profile</Text>
          <TextInput
            style={s.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Your name"
            placeholderTextColor={c.textMuted}
            autoCapitalize="words"
          />
        </View>

        {/* AI Provider */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>AI Provider</Text>

          {/* Toggle */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: c.surfaceAlt,
            borderRadius: 12,
            padding: 3,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 16,
          }}>
            {([
              { key: 'groq', label: 'Groq', sublabel: 'Free' },
              { key: 'ollama', label: 'Ollama', sublabel: 'Local' },
              { key: 'anthropic', label: 'Anthropic', sublabel: 'Paid' },
            ] as const).map((p) => {
              const active = provider === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setProvider(p.key)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: active ? c.primary : 'transparent',
                    gap: 1,
                  }}
                >
                  <Text style={{ color: active ? (c.isDark ? c.bg : '#fff') : c.text, fontSize: 14, fontWeight: '500' }}>
                    {p.label}
                  </Text>
                  <Text style={{ color: active ? (c.isDark ? c.bg + 'cc' : '#ffffffcc') : c.textMuted, fontSize: 10 }}>
                    {p.sublabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Groq key */}
          {provider === 'groq' && (
            <>
              <View style={s.keyRow}>
                <TextInput
                  style={s.keyInput}
                  value={groqKeyInput}
                  onChangeText={setGroqKeyInput}
                  placeholder="gsk_..."
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.showBtn} onPress={() => setShowKey(!showKey)}>
                  <Text style={s.showBtnText}>{showKey ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.hintText}>
                Free at console.groq.com → API Keys{'\n'}
                Uses Llama 3.3 70B — very capable, ~14,400 free requests/day
              </Text>
            </>
          )}

          {/* Ollama */}
          {provider === 'ollama' && (
            <>
              <TextInput
                style={s.input}
                value={ollamaUrlInput}
                onChangeText={setOllamaUrlInput}
                placeholder="http://192.168.x.x:11434"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextInput
                style={[s.input, { marginTop: 8 }]}
                value={ollamaModelInput}
                onChangeText={setOllamaModelInput}
                placeholder="Model name (e.g. llama3.2)"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={s.hintText}>
                {'1. Install: brew install ollama\n'}
                {'2. Pull model: ollama pull llama3.2\n'}
                {'3. Run: ollama serve\n'}
                {'4. Enter your Mac\'s local IP above (find it in System Settings → Wi-Fi → Details)\n'}
                {'If VPN breaks LAN, expose via ngrok: ngrok http 11434 → paste the https URL'}
              </Text>
            </>
          )}

          {/* Anthropic key */}
          {provider === 'anthropic' && (
            <>
              <View style={s.keyRow}>
                <TextInput
                  style={s.keyInput}
                  value={keyInput}
                  onChangeText={setKeyInput}
                  placeholder="sk-ant-..."
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={s.showBtn} onPress={() => setShowKey(!showKey)}>
                  <Text style={s.showBtnText}>{showKey ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.hintText}>
                Get your key at console.anthropic.com → API Keys
              </Text>
            </>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[s.saveBtn, { flex: 1 }]} onPress={saveProfile}>
            <Text style={s.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={testConnection}
            disabled={testing}
            style={{
              flex: 1,
              backgroundColor: c.surfaceAlt,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: testing ? c.textMuted : c.primary, fontSize: 15, fontWeight: '500' }}>
              {testing ? 'Testing…' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Theme */}
        <View style={[s.section, { marginTop: 32 }]}>
          <Text style={s.sectionLabel}>Colour Mode</Text>
          <View style={s.themeRow}>
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const preview = THEME_PREVIEWS[key];
              const isSelected = theme === key;
              const textCol = isSelected ? c.primary : c.textSecondary;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.themeCard, { backgroundColor: preview.bg }, isSelected && s.themeCardSelected]}
                  onPress={() => setTheme(key)}
                >
                  <View style={[s.themePreview, { backgroundColor: preview.surface }]}>
                    <View style={[s.themePreviewAccent, { backgroundColor: preview.primary }]} />
                  </View>
                  <Text style={[s.themeLabel, { color: textCol }]}>{THEME_NAMES[key]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Calendar */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Calendar</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['monday', 'sunday'] as const).map((day) => {
              const active = weekStartDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setWeekStartDay(day)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12,
                    borderRadius: 12, borderWidth: 1,
                    backgroundColor: active ? c.primaryFaint : c.surface,
                    borderColor: active ? c.primary : c.border,
                  }}
                >
                  <Text style={{ color: active ? c.primary : c.textSecondary, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' }}>
                    {day === 'monday' ? 'Mon–Sun' : 'Sun–Sat'}
                  </Text>
                  <Text style={{ color: active ? c.primary : c.textMuted, fontSize: 11, marginTop: 2 }}>
                    Week starts {day === 'monday' ? 'Monday' : 'Sunday'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Developer Options */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Developer Options</Text>

          <TouchableOpacity
            onPress={triggerBriefing}
            disabled={triggeringBriefing}
            style={{ backgroundColor: '#3EB87A18', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#3EB87A50', alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ color: triggeringBriefing ? c.textMuted : '#3EB87A', fontSize: 14, fontWeight: '600' }}>
              {triggeringBriefing ? 'Triggering…' : 'Trigger Morning Briefing'}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 3 }}>Re-runs today's briefing and shows the banner</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => __seedDevState('A').then(() => Alert.alert('Dev', 'Seeded: Perfect Yesterday (94)'))}
              style={{ flex: 1, backgroundColor: '#3EB87A18', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#3EB87A50', alignItems: 'center' }}
            >
              <Text style={{ color: '#3EB87A', fontSize: 13, fontWeight: '600' }}>Seed A · Perfect</Text>
              <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 2 }}>Yesterday score 94</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => __seedDevState('B').then(() => Alert.alert('Dev', 'Seeded: Rough Yesterday (41)'))}
              style={{ flex: 1, backgroundColor: '#E05C5C18', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E05C5C50', alignItems: 'center' }}
            >
              <Text style={{ color: '#E05C5C', fontSize: 13, fontWeight: '600' }}>Seed B · Rough</Text>
              <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 2 }}>Yesterday score 41</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Categories */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Custom Categories</Text>
          <View style={s.catList}>
            {customCategories.map((cat) => (
              <View key={cat.id} style={s.catItem}>
                <View style={[s.catDot, { backgroundColor: cat.color }]} />
                <Text style={s.catName}>{cat.name}</Text>
                <TouchableOpacity onPress={() => confirmDeleteCat(cat.id, cat.name)}>
                  <Text style={s.catDelete}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.addCatBtn} onPress={() => setCatModalVisible(true)}>
            <Text style={s.addCatText}>+ Add Category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Category Modal */}
      <Modal visible={catModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setCatModalVisible(false)}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>New Category</Text>
            <TouchableOpacity onPress={addCat}>
              <Text style={s.modalSave}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalContent}>
            <Text style={s.fieldLabel}>Name</Text>
            <TextInput
              style={s.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="Category name"
              placeholderTextColor={c.textMuted}
              autoFocus
            />

            <Text style={s.fieldLabel}>Colour</Text>
            <View style={s.colorGrid}>
              {PRESET_COLORS.map((p) => (
                <TouchableOpacity
                  key={p.color}
                  style={[s.colorSwatch, { backgroundColor: p.color }, catColor === p.color && s.colorSwatchSelected]}
                  onPress={() => { setCatColor(p.color); setCatBg(p.bg); }}
                >
                  {catColor === p.color && <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
