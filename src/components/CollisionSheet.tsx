import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Collision } from '../utils/collisions';

const CONFLICT_COLOR = '#E05C5C';

interface Props {
  collision: Collision | null;
  /** The block ID that was tapped — used to determine which block to move for block-block. */
  primaryBlockId: string | null;
  c: any;
  onMoveBlock: (blockId: string) => void;
  /** Skip the primary block for today (creates a persistent skipped resolution). */
  onSkipPrimary: () => void;
  /** Title of the block that will be skipped — displayed in the button label. */
  skipPrimaryTitle: string;
  onClose: () => void;
}

export function CollisionSheet({ collision, primaryBlockId, c, onMoveBlock, onSkipPrimary, skipPrimaryTitle, onClose }: Props) {
  if (!collision) return null;

  const isBlockBlock = collision.type === 'block-block';
  const isEventEvent = collision.type === 'event-event';

  const typeLabel = isBlockBlock
    ? 'Block conflict'
    : collision.type === 'block-event'
    ? 'Block conflicts with calendar event'
    : 'Calendar conflict — edit in Calendar app';

  const moveId = isBlockBlock
    ? (primaryBlockId ?? collision.idA)
    : collision.idA; // for block-event, idA is always the block

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTopWidth: 1, borderTopColor: c.border,
            paddingBottom: 40,
          }}>
            <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 18 }} />

            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="warning-outline" size={15} color={CONFLICT_COLOR} />
                <Text style={{ color: CONFLICT_COLOR, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {typeLabel}
                </Text>
              </View>

              <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: CONFLICT_COLOR }}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{collision.titleA}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {collision.startA} – {collision.endA}
                </Text>
              </View>

              <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: CONFLICT_COLOR + '60' }}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{collision.titleB}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {collision.startB} – {collision.endB}
                </Text>
              </View>
            </View>

            {isEventEvent ? (
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
                  These calendar events overlap. Open the Calendar app to resolve them.
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ paddingVertical: 15, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: 'center', borderWidth: 1, borderColor: c.border }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                <TouchableOpacity
                  onPress={() => onMoveBlock(moveId)}
                  style={{ paddingVertical: 15, borderRadius: 13, backgroundColor: c.primary, alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: c.isDark ? c.bg : '#fff', fontSize: 15, fontWeight: '600' }}>Move to a different time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onSkipPrimary}
                  style={{ paddingVertical: 13, borderRadius: 13, backgroundColor: '#E05C5C14', alignItems: 'center', borderWidth: 1, borderColor: '#E05C5C40', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#E05C5C" />
                  <Text style={{ color: '#E05C5C', fontSize: 15, fontWeight: '500' }}>
                    Skip "{skipPrimaryTitle}" today
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: -4 }}>
                  Skipping is reversible — tap the block in Day view to undo
                </Text>
                <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, alignItems: 'center' }} activeOpacity={0.7}>
                  <Text style={{ color: c.textMuted, fontSize: 14 }}>Close without resolving</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
