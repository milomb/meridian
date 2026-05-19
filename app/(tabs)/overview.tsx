import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../src/theme/colors';
import {
  useLifeElementStore, computeWeeklyMinutes, fmtWeeklyTime, LifeElement,
} from '../../src/store/lifeElementStore';
import { useScheduleStore } from '../../src/store/scheduleStore';

export default function OverviewScreen() {
  const c = useColors();
  const { elements, load, updateElement } = useLifeElementStore();
  const { blocks, load: loadBlocks } = useScheduleStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => { load(); loadBlocks(); }, []);

  const openEdit = (el: LifeElement) => {
    setDraft(el.status);
    setEditingId(el.id);
  };

  const commitEdit = (id: string) => {
    updateElement(id, { status: draft });
    setEditingId(null);
  };

  const sorted = [...elements].sort(
    (a, b) => computeWeeklyMinutes(b.name, blocks) - computeWeeklyMinutes(a.name, blocks)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: '600' }}>Life Overview</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>
          This week's scheduled time per area of life.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.map((el) => {
          const mins = computeWeeklyMinutes(el.name, blocks);
          const isEditing = editingId === el.id;

          return (
            <View
              key={el.id}
              style={{
                backgroundColor: c.surface,
                borderRadius: 18,
                padding: 20,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              {/* Name row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 28, marginRight: 12 }}>{el.emoji}</Text>
                <Text style={{ color: el.color, fontSize: 20, fontWeight: '600', flex: 1 }}>{el.name}</Text>
                <View style={{
                  backgroundColor: el.bg,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}>
                  <Text style={{ color: el.color, fontSize: 15, fontWeight: '600' }}>
                    {fmtWeeklyTime(mins)}
                  </Text>
                </View>
              </View>

              {/* Status */}
              {isEditing ? (
                <TextInput
                  autoFocus
                  value={draft}
                  onChangeText={setDraft}
                  onBlur={() => commitEdit(el.id)}
                  onSubmitEditing={() => commitEdit(el.id)}
                  placeholder="Add a one-liner status…"
                  placeholderTextColor={c.textMuted}
                  returnKeyType="done"
                  style={{
                    color: c.textSecondary,
                    fontSize: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: el.color + '60',
                    paddingVertical: 4,
                  }}
                />
              ) : (
                <TouchableOpacity onPress={() => openEdit(el)} activeOpacity={0.7}>
                  <Text style={{
                    color: el.status ? c.textSecondary : c.textMuted,
                    fontSize: 14,
                    fontStyle: el.status ? 'normal' : 'italic',
                  }}>
                    {el.status || 'Add a status…'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {elements.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
            <Text style={{ fontSize: 44 }}>🌿</Text>
            <Text style={{ color: c.textSecondary, fontSize: 16, fontWeight: '500' }}>
              No life elements yet
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Go to Settings to add your first life elements.
            </Text>
          </View>
        )}

        <Text style={{ color: c.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          Manage elements in Settings · Tap a status to edit it
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
