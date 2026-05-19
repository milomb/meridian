import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { TimeBlock } from '../store/scheduleStore';
import { BlockOverride } from '../store/blockOverrideStore';

interface Props {
  block: TimeBlock | null;
  date: string; // YYYY-MM-DD
  existingOverride?: BlockOverride;
  c: any;
  onConfirm: (override: BlockOverride) => void;
  onCancel: () => void;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function addMins(hhmm: string, mins: number): string {
  const total = Math.max(0, toMins(hhmm) + mins) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const HHMM_RE = /^\d{2}:\d{2}$/;

export function BlockMoveSheet({ block, date, existingOverride, c, onConfirm, onCancel }: Props) {
  const [newStart, setNewStart] = useState('');

  // Reset input each time the sheet opens for a (potentially different) block
  useEffect(() => {
    if (block) {
      setNewStart(existingOverride?.overrideStart ?? block.startTime);
    }
  }, [block?.id, existingOverride?.overrideStart]);

  if (!block) return null;

  const originalStart = block.startTime;
  const originalEnd = block.endTime;
  const durationMins = toMins(originalEnd) - toMins(originalStart);
  const valid = HHMM_RE.test(newStart);
  const derivedEnd = valid ? addMins(newStart, durationMins) : null;

  const handleConfirm = () => {
    if (!valid || !derivedEnd) return;
    onConfirm({
      blockId: block.id,
      date,
      originalStart,
      originalEnd,
      overrideStart: newStart,
      overrideEnd: derivedEnd,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTopWidth: 1, borderTopColor: c.border,
            paddingBottom: 40,
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 18 }} />

            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{block.title}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 3 }}>
                Original: {originalStart} – {originalEnd}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
              <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                New start time
              </Text>
              <TextInput
                value={newStart}
                onChangeText={setNewStart}
                placeholder="HH:MM"
                placeholderTextColor={c.textMuted}
                style={{
                  backgroundColor: c.surfaceAlt, borderRadius: 10,
                  borderWidth: 1.5, borderColor: valid ? c.primary : c.border,
                  paddingHorizontal: 16, paddingVertical: 13,
                  color: c.text, fontSize: 20, fontWeight: '500', letterSpacing: 1,
                }}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoFocus
              />
              {valid && derivedEnd ? (
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>
                  Ends at {derivedEnd} · same duration
                </Text>
              ) : null}
            </View>

            <View style={{ marginHorizontal: 20, backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 18 }}>
              <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
                This only affects today. Your recurring schedule is unchanged.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10 }}>
              <TouchableOpacity
                onPress={onCancel}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
                activeOpacity={0.7}
              >
                <Text style={{ color: c.textSecondary, fontSize: 15, fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!valid}
                style={{ flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: valid ? c.primary : c.border, alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ color: valid ? (c.isDark ? c.bg : '#fff') : c.textMuted, fontSize: 15, fontWeight: '600' }}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
