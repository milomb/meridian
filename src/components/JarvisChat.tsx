import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../theme/colors';
import { sendToJarvis, JarvisMessage, UiAction } from '../services/groqApi';
import { buildJarvisStateJson } from '../store/jarvisStore';
import { useScheduleStore, DayOfWeek } from '../store/scheduleStore';
import { useResolutionStore } from '../store/resolutionStore';
import { useBlockOverrideStore } from '../store/blockOverrideStore';
import { todayDateKey } from '../store/performanceStore';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  groqApiKey: string;
  initialMessage?: string | null;
}

function routeAction(action: UiAction) {
  const { type, payload } = action;
  if (type === 'NONE') return;

  const blocks = useScheduleStore.getState().blocks;
  const dateKey = todayDateKey();

  if (type === 'SKIP_BLOCK') {
    useResolutionStore.getState().resolveBlock(payload.block_id, dateKey, 'skipped');
    return;
  }

  if (type === 'COMPLETE_BLOCK') {
    useResolutionStore.getState().resolveBlock(payload.block_id, dateKey, 'done');
    return;
  }

  if (type === 'UNRESOLVE_BLOCK') {
    useResolutionStore.getState().unresolveBlock(payload.block_id, dateKey);
    return;
  }

  if (type === 'DELETE_BLOCK') {
    useScheduleStore.getState().deleteBlock(payload.block_id);
    return;
  }

  if (type === 'UPDATE_BLOCK_OUTCOME') {
    const { block_id, rating, note } = payload;
    const resStore = useResolutionStore.getState();
    const existing = resStore.getResolution(block_id, dateKey);
    resStore.resolveBlock(block_id, dateKey, existing?.status ?? 'done', {
      rating: rating !== undefined ? rating : (existing?.outcome.rating ?? null),
      note: note !== undefined ? note : (existing?.outcome.note ?? null),
    });
    return;
  }

  if (type === 'MOVE_BLOCK_TODAY') {
    const block = blocks.find((b) => b.id === payload.block_id);
    if (!block || !payload.new_time) return;
    const [sh, sm] = block.startTime.split(':').map(Number);
    const [eh, em] = block.endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    const [nh, nm] = (payload.new_time as string).split(':').map(Number);
    const endMin = nh * 60 + nm + duration;
    const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    useBlockOverrideStore.getState().setOverride({
      blockId: payload.block_id,
      date: dateKey,
      originalStart: block.startTime,
      originalEnd: block.endTime,
      overrideStart: payload.new_time,
      overrideEnd: newEnd,
    });
    return;
  }

  if (type === 'MOVE_BLOCK_PERMANENTLY') {
    const block = blocks.find((b) => b.id === payload.block_id);
    if (!block || !payload.new_time) return;
    const [sh, sm] = block.startTime.split(':').map(Number);
    const [eh, em] = block.endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    const [nh, nm] = (payload.new_time as string).split(':').map(Number);
    const endMin = nh * 60 + nm + duration;
    const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    useScheduleStore.getState().updateBlock(payload.block_id, {
      startTime: payload.new_time,
      endTime: newEnd,
    });
    return;
  }

  if (type === 'CREATE_BLOCK') {
    const { name, time, duration_minutes, weight, is_permanent } = payload;
    if (!time) return;
    const [sh, sm] = (time as string).split(':').map(Number);
    const endMin = sh * 60 + sm + (duration_minutes ?? 60);
    const endStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const todayDow = new Date().getDay() as DayOfWeek;
    useScheduleStore.getState().addBlock({
      title: name,
      description: '',
      startTime: time,
      endTime: endStr,
      category: 'personal',
      daysOfWeek: is_permanent ? [0, 1, 2, 3, 4, 5, 6] : [todayDow],
      isFixed: !!is_permanent,
      reminder: false,
      weight: weight ?? 2,
    });
  }
}

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 6 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3EB87A', opacity: d }}
        />
      ))}
    </View>
  );
}

export function JarvisChat({ visible, onClose, groqApiKey, initialMessage }: Props) {
  const c = useColors();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Seed initial message if provided (morning briefing)
  useEffect(() => {
    if (visible && initialMessage) {
      setMessages([{ role: 'assistant', content: initialMessage }]);
    } else if (visible) {
      setMessages([]);
    }
  }, [visible, initialMessage]);

  // Slide-up animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInputText('');

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    scrollToBottom();

    const history: JarvisMessage[] = nextMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const stateJson = buildJarvisStateJson();
    const response = await sendToJarvis(groqApiKey, history, stateJson);

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: response.jarvis_speech },
    ]);
    setLoading(false);
    scrollToBottom();

    routeAction(response.ui_action);
  };

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }).start(onClose);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />

        <Animated.View style={{
          height: '92%',
          backgroundColor: c.bg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTopWidth: 1,
          borderTopColor: c.border,
          transform: [{ translateY: slideAnim }],
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: c.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: '#3EB87A',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>J</Text>
              </View>
              <View>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Jarvis</Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>Chief of Staff</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Message stream */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && !loading && (
              <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
                <Text style={{ color: c.textMuted, fontSize: 14 }}>Talk to Jarvis</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>
                  Skip a block, move a session, review your day.
                </Text>
              </View>
            )}

            {messages.map((msg, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: 8,
                }}
              >
                {msg.role === 'assistant' && (
                  <View style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: '#3EB87A',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 2,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>J</Text>
                  </View>
                )}
                <View style={{
                  maxWidth: '78%',
                  backgroundColor: msg.role === 'user' ? c.primary : c.surface,
                  borderRadius: 16,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: msg.role === 'assistant' ? 1 : 0,
                  borderColor: c.border,
                }}>
                  <Text style={{
                    color: msg.role === 'user' ? (c.isDark ? c.bg : '#fff') : c.text,
                    fontSize: 14,
                    lineHeight: 20,
                    fontWeight: '400',
                  }}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}

            {loading && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: '#3EB87A',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>J</Text>
                </View>
                <View style={{
                  backgroundColor: c.surface,
                  borderRadius: 16, borderBottomLeftRadius: 4,
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderWidth: 1, borderColor: c.border,
                }}>
                  <TypingDots />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={{
              flexDirection: 'row', alignItems: 'flex-end', gap: 10,
              padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
              borderTopWidth: 1, borderTopColor: c.border,
            }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: c.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: c.border,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  color: c.text,
                  fontSize: 15,
                  maxHeight: 100,
                }}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Talk to Jarvis..."
                placeholderTextColor={c.textMuted}
                multiline
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={() => send(inputText)}
              />
              <TouchableOpacity
                onPress={() => send(inputText)}
                disabled={!inputText.trim() || loading}
                style={{
                  width: 42, height: 42, borderRadius: 21,
                  backgroundColor: inputText.trim() && !loading ? '#3EB87A' : c.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={inputText.trim() && !loading ? '#fff' : c.textMuted}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}
