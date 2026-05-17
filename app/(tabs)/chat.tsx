import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useColors } from '../../src/theme/colors';
import { useSettingsStore } from '../../src/store/settingsStore';
import { sendAIMessage, AIMessage } from '../../src/utils/ai';
import { parseAIResponse, executeAction, buildSystemPrompt, getActionLabel, AIAction } from '../../src/utils/aiActions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;     // shown to user
  rawContent?: string; // full raw AI response — sent back in history so AI keeps context
  timestamp: Date;
  actionResult?: string;
}

let bestVoiceId: string | undefined;
async function getBestVoice() {
  if (bestVoiceId !== undefined) return bestVoiceId;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const en = voices.filter((v) => v.language?.startsWith('en'));
    const premium = en.find((v) => /premium|enhanced|siri/i.test(v.name ?? ''));
    bestVoiceId = premium?.identifier ?? en[0]?.identifier ?? '';
  } catch {
    bestVoiceId = '';
  }
  return bestVoiceId;
}

async function speakText(text: string, onDone: () => void) {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
  } catch {}
  const voice = await getBestVoice();
  Speech.speak(text, {
    rate: 0.9,
    pitch: 1.0,
    language: 'en-US',
    ...(voice ? { voice } : {}),
    onDone,
    onError: onDone,
  });
}

function MessageBubble({ message, c }: { message: Message; c: any }) {
  const isUser = message.role === 'user';
  return (
    <View style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 5 }}>
      <View style={{
        borderRadius: 18,
        padding: 12,
        backgroundColor: isUser ? c.primary : c.surface,
        borderWidth: isUser ? 0 : 1,
        borderColor: c.border,
        borderBottomRightRadius: isUser ? 4 : 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
      }}>
        <Text style={{
          fontSize: 15, lineHeight: 22, fontWeight: '400',
          color: isUser ? (c.isDark ? c.bg : '#fff') : c.text,
        }}>
          {message.content}
        </Text>
        <Text style={{
          fontSize: 10, marginTop: 4,
          color: isUser ? (c.isDark ? c.bg + '99' : '#ffffff88') : c.textMuted,
          alignSelf: 'flex-end',
        }}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {message.actionResult && (
        <View style={{
          backgroundColor: c.success + '18',
          borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
          borderWidth: 1, borderColor: c.success + '40',
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Ionicons name="checkmark-circle" size={14} color={c.success} />
          <Text style={{ color: c.success, fontSize: 12, fontWeight: '500' }}>
            {message.actionResult}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ChatScreen() {
  const c = useColors();
  const { apiKey, groqApiKey, ollamaUrl, ollamaModel, provider, userName } = useSettingsStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const activeKey = provider === 'groq' ? groqApiKey : provider === 'ollama' ? ollamaUrl : apiKey;
  const providerLabel = provider === 'groq' ? 'Groq · Llama 3.3' : provider === 'ollama' ? 'Ollama' : 'Claude';
  const actionLabel = getActionLabel(pendingAction ?? undefined);

  // Prefetch voice on mount
  useEffect(() => { getBestVoice(); }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!activeKey) {
      Alert.alert('No AI configured', 'Add a key or Ollama URL in Browse → Settings.', [
        { text: 'Settings', onPress: () => router.push('/(tabs)/settings' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    const trimmed = text.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Use rawContent for AI history so it keeps full action context across turns
      const history: AIMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.rawContent ?? m.content,
      }));

      const system = buildSystemPrompt(userName);
      const raw = await sendAIMessage(history, system, provider, apiKey, groqApiKey, 800, ollamaUrl, ollamaModel);
      const parsed = parseAIResponse(raw);

      // Execute if ready, else track pending
      let actionResult: string | undefined;
      if (parsed.action && parsed.action.type !== 'NONE') {
        const result = executeAction(parsed.action);
        if (result) {
          actionResult = result;
          setPendingAction(null);
        } else {
          setPendingAction(parsed.action);
        }
      } else {
        setPendingAction(null);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: parsed.message,
        rawContent: raw, // ← full JSON kept for AI history
        timestamp: new Date(),
        actionResult,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(trimmed);
      Alert.alert('Failed to send', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const speakLast = () => {
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); return; }
    setIsSpeaking(true);
    speakText(last.content, () => setIsSpeaking(false));
  };

  const clearChat = () => {
    setMessages([]);
    setPendingAction(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12,
      }}>
        <View>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '600' }}>AI Chat</Text>
          <Text style={{ color: activeKey ? c.textMuted : c.error, fontSize: 11, marginTop: 1, fontWeight: '400' }}>
            {providerLabel}{activeKey ? '' : ' · no key set'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={speakLast}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name={isSpeaking ? 'volume-mute-outline' : 'volume-high-outline'} size={18} color={c.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status banner — shows while building an action */}
      {actionLabel && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: c.primaryFaint, borderBottomWidth: 1, borderBottomColor: c.border,
          paddingHorizontal: 20, paddingVertical: 8,
        }}>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>{actionLabel}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 10 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '500' }}>
                {userName ? `Hey ${userName.split(' ')[0]}! 👋` : 'Hey there! 👋'}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21, fontWeight: '400' }}>
                {"Ask me anything — 'what's today look like?', 'create a workout block', or just chat."}
              </Text>
              {!activeKey && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/settings' as any)}
                  style={{
                    backgroundColor: c.primaryFaint, borderRadius: 12,
                    paddingHorizontal: 20, paddingVertical: 10,
                    borderWidth: 1, borderColor: c.primary + '60', marginTop: 8,
                  }}
                >
                  <Text style={{ color: c.primary, fontSize: 14, fontWeight: '500' }}>Set up AI →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {messages.map((m) => <MessageBubble key={m.id} message={m} c={c} />)}

          {loading && (
            <View style={{
              alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: c.surface, borderRadius: 18, padding: 12,
              borderWidth: 1, borderColor: c.border,
            }}>
              <ActivityIndicator color={c.primary} size="small" />
              <Text style={{ color: c.textSecondary, fontSize: 14, fontWeight: '400' }}>…</Text>
            </View>
          )}
        </ScrollView>

        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          padding: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 8,
          backgroundColor: c.bg,
        }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: c.surface, borderRadius: 22,
              borderWidth: 1, borderColor: c.border,
              paddingHorizontal: 16, paddingVertical: 10,
              color: c.text, fontSize: 15, maxHeight: 120, fontWeight: '400',
            }}
            value={input}
            onChangeText={setInput}
            placeholder={pendingAction ? 'Reply to continue…' : "Message Meridian…"}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: (!input.trim() || loading) ? c.border : c.primary,
              alignItems: 'center', justifyContent: 'center',
            }}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={18} color={c.isDark ? c.bg : '#fff'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
