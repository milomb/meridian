import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Anthropic from '@anthropic-ai/sdk';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { colors } from '../../src/theme/colors';

const API_KEY_STORAGE = '@meridian:anthropic_key';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
        {message.content}
      </Text>
      <Text style={styles.bubbleTime}>
        {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(API_KEY_STORAGE).then((k) => {
      if (k) setApiKey(k);
      else setShowKeyInput(true);
    });
  }, []);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    await AsyncStorage.setItem(API_KEY_STORAGE, keyInput.trim());
    setApiKey(keyInput.trim());
    setShowKeyInput(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!apiKey) { setShowKeyInput(true); return; }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const client = new Anthropic({ apiKey });
      const history = [...messages, userMsg].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system:
          'You are Meridian AI, a personal productivity and wellness assistant. Help the user with scheduling, habits, goals, and personal development. Be concise, warm, and actionable.',
        messages: history,
      });

      const assistantText =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to get response');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    setRecording(null);
    // Without Whisper integration, prompt user to type
    Alert.alert('Voice Input', 'Voice transcription requires a Whisper API integration. Type your message instead.');
  };

  const speakLastMessage = () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(last.content, {
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      rate: 0.95,
      pitch: 1.0,
    });
  };

  if (showKeyInput) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.keySetup}>
          <Text style={styles.keyTitle}>Anthropic API Key</Text>
          <Text style={styles.keySubtitle}>
            Enter your key to enable AI Chat. It's stored locally on your device.
          </Text>
          <TextInput
            style={styles.keyInput}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <TouchableOpacity onPress={saveKey} style={styles.keyBtn}>
            <Text style={styles.keyBtnText}>Save Key</Text>
          </TouchableOpacity>
          {apiKey && (
            <TouchableOpacity onPress={() => setShowKeyInput(false)} style={styles.keySkip}>
              <Text style={styles.keySkipText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.chatHeader}>
        <Text style={styles.title}>AI Chat</Text>
        <View style={styles.chatHeaderRight}>
          <TouchableOpacity onPress={speakLastMessage} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>{isSpeaking ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowKeyInput(true)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 && (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Hello! I'm Meridian AI.</Text>
              <Text style={styles.emptyChatSub}>Ask me about your schedule, habits, or goals.</Text>
            </View>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {loading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.loadingText}>Thinking…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
          >
            <Text style={styles.voiceBtnText}>{recording ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.inputField}
            value={input}
            onChangeText={setInput}
            placeholder="Message Meridian…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  chatHeaderRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8, gap: 10 },
  emptyChat: { alignItems: 'center', marginTop: 60 },
  emptyChatText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptyChatSub: { color: colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: colors.bg },
  bubbleTextAssistant: { color: colors.text },
  bubbleTime: { fontSize: 10, marginTop: 4, color: colors.textMuted, alignSelf: 'flex-end' },
  loadingBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    backgroundColor: colors.bg,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnActive: { backgroundColor: colors.error + '30', borderColor: colors.error },
  voiceBtnText: { fontSize: 18 },
  inputField: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: colors.bg, fontSize: 18, fontWeight: '700' },
  // Key setup
  keySetup: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  keyTitle: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  keySubtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 28 },
  keyInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    color: colors.text,
    fontSize: 15,
    marginBottom: 16,
  },
  keyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  keyBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  keySkip: { marginTop: 12, alignItems: 'center' },
  keySkipText: { color: colors.textSecondary, fontSize: 15 },
});
