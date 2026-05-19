import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/theme/colors';
import {
  useProtocolStore, Protocol, ProtocolDraft, protoDateKey, CompletionState, TimeOfDay,
} from '../../src/store/protocolStore';
import { ProtocolEditor } from '../../src/components/ProtocolEditor';

const TOD_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', midday: 'Midday', evening: 'Evening', custom: 'Custom' };
const STATE_COLOR: Record<CompletionState, string> = {
  complete: '#3EB87A', partial: '#D4A574', missed: '#E05C5C', pending: '#888888',
};
const STATE_LABEL: Record<CompletionState, string> = {
  complete: 'Complete ✓', partial: 'Partial', missed: 'Missed', pending: 'Pending',
};

export default function ProtocolsScreen() {
  const c = useColors();
  const {
    protocols, loaded, load,
    toggleStep, getLog, getCompletionState,
    addProtocol, updateProtocol, archiveProtocol, sortedActiveProtocols,
  } = useProtocolStore();
  const today = protoDateKey();

  const [sheetProtoId, setSheetProtoId] = useState<string | null>(null);
  const [editorProto, setEditorProto] = useState<Protocol | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { load(); }, []);

  const openSheet = (id: string) => {
    sheetAnim.setValue(600); backdropAnim.setValue(0);
    setSheetProtoId(id);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 600, duration: 180, useNativeDriver: true }),
    ]).start(() => setSheetProtoId(null));
  };

  const openEditor = (p?: Protocol) => { setEditorProto(p); setEditorOpen(true); };

  const handleSave = (data: ProtocolDraft) => {
    if (editorProto) updateProtocol(editorProto.id, data); else addProtocol(data);
    setEditorOpen(false);
  };

  const active = sortedActiveProtocols();
  const liveProto = sheetProtoId ? protocols.find((p) => p.id === sheetProtoId) ?? null : null;
  const sheetLog = liveProto ? getLog(liveProto.id, today) : undefined;
  const required = liveProto?.steps.filter((s) => s.type === 'required') ?? [];
  const bonus = liveProto?.steps.filter((s) => s.type === 'bonus') ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={20} color={c.primary} />
          <Text style={{ color: c.primary, fontSize: 15 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, color: c.text, fontSize: 22, fontWeight: '600' }}>Protocols</Text>
        <TouchableOpacity onPress={() => openEditor()} style={{ backgroundColor: c.primaryFaint, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.primary + '60' }}>
          <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {active.length === 0 && loaded && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Text style={{ fontSize: 44 }}>🎯</Text>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '500' }}>No protocols yet</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>Build morning and evening routines to track your daily habits and streak.</Text>
          </View>
        )}

        {active.map((p) => {
          const state = getCompletionState(p.id, today);
          const stateColor = STATE_COLOR[state];
          return (
            <TouchableOpacity key={p.id} onPress={() => openSheet(p.id)} activeOpacity={0.7}
              style={{ backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border, borderLeftWidth: 3, borderLeftColor: p.color }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 28 }}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{p.name}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {TOD_LABELS[p.timeOfDay]}{p.timeOfDay === 'custom' && p.customTime ? ` · ${p.customTime}` : ''}
                    {'  '}
                    <Text style={{ color: stateColor, fontWeight: '500' }}>{STATE_LABEL[state]}</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {p.currentStreak >= 3 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Text style={{ fontSize: 13 }}>🔥</Text>
                      <Text style={{ color: c.primary, fontSize: 14, fontWeight: '700' }}>{p.currentStreak}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Completion bottom sheet */}
      <Modal visible={!!sheetProtoId} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropAnim }}>
            <Pressable style={{ flex: 1 }} onPress={closeSheet} />
          </Animated.View>

          <Animated.View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, maxHeight: '82%', transform: [{ translateY: sheetAnim }] }}>
            <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />

            {liveProto && (
              <>
                {/* Sheet header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 30 }}>{liveProto.icon}</Text>
                    <View>
                      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{liveProto.name}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{TOD_LABELS[liveProto.timeOfDay]}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => { closeSheet(); setTimeout(() => openEditor(liveProto), 320); }} style={{ padding: 8 }}>
                    <Ionicons name="create-outline" size={20} color={c.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Steps */}
                <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                  {required.map((step) => {
                    const done = sheetLog?.completedStepIds.includes(step.id) ?? false;
                    return (
                      <TouchableOpacity key={step.id} onPress={() => toggleStep(liveProto.id, today, step.id)} activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border + '55' }}
                      >
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: done ? '#3EB87A' : c.border, backgroundColor: done ? '#3EB87A' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {done && <Ionicons name="checkmark" size={13} color="#fff" />}
                        </View>
                        <Text style={{ color: done ? '#3EB87A' : c.text, fontSize: 15, flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}>{step.label}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {bonus.length > 0 && (
                    <>
                      <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 4 }}>Bonus</Text>
                      {bonus.map((step) => {
                        const done = sheetLog?.completedStepIds.includes(step.id) ?? false;
                        return (
                          <TouchableOpacity key={step.id} onPress={() => toggleStep(liveProto.id, today, step.id)} activeOpacity={0.7}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.border + '55' }}
                          >
                            <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: done ? '#F59E0B' : c.border, backgroundColor: done ? '#F59E0B20' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 11 }}>{done ? '⭐' : '☆'}</Text>
                            </View>
                            <Text style={{ color: done ? '#F59E0B' : c.text, fontSize: 15, flex: 1 }}>{step.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </ScrollView>

                {/* Streak footer */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border + '55', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {liveProto.currentStreak >= 1 ? (
                    <>
                      <Text style={{ fontSize: 18 }}>🔥</Text>
                      <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{liveProto.currentStreak} day streak</Text>
                      {liveProto.longestStreak > liveProto.currentStreak && (
                        <Text style={{ color: c.textMuted, fontSize: 12 }}>· best {liveProto.longestStreak}</Text>
                      )}
                    </>
                  ) : (
                    <Text style={{ color: c.textSecondary, fontSize: 13 }}>Complete required steps to start a streak</Text>
                  )}
                </View>
                <View style={{ height: 24 }} />
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      <ProtocolEditor
        visible={editorOpen}
        protocol={editorProto}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onArchive={editorProto ? () => { archiveProtocol(editorProto.id); setEditorOpen(false); } : undefined}
        c={c}
      />
    </SafeAreaView>
  );
}
