import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Protocol, ProtocolDraft, ProtocolStep, PROTOCOL_COLORS, TimeOfDay } from '../store/protocolStore';
import { ThemeColors } from '../theme/themes';

const EMOJIS = [
  '☀️','🌙','💪','🧘','📚','💤','🥗','🏃','🧠','💡',
  '🎯','✍️','🌊','🔥','⚡','🌿','🎵','🧊','💧','🏋️',
  '🤸','🧩','📝','🌱','🙏','⭐','🌟','❤️','🏆','🌅',
];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TOD_OPTS: TimeOfDay[] = ['morning', 'midday', 'evening', 'custom'];
const TOD_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', midday: 'Midday', evening: 'Evening', custom: 'Custom' };

function newStep(label = ''): ProtocolStep {
  return { id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, label, type: 'required' };
}

interface Props {
  visible: boolean;
  protocol?: Protocol;
  onClose: () => void;
  onSave: (data: ProtocolDraft) => void;
  onArchive?: () => void;
  c: ThemeColors;
}

export function ProtocolEditor({ visible, protocol, onClose, onSave, onArchive, c }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState<string>(PROTOCOL_COLORS[0]);
  const [tod, setTod] = useState<TimeOfDay>('morning');
  const [customTime, setCustomTime] = useState('08:00');
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [steps, setSteps] = useState<ProtocolStep[]>([newStep()]);
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (protocol) {
      setName(protocol.name); setIcon(protocol.icon); setColor(protocol.color);
      setTod(protocol.timeOfDay); setCustomTime(protocol.customTime ?? '08:00');
      setActiveDays(protocol.activeDays); setSteps(protocol.steps.length ? protocol.steps : [newStep()]);
    } else {
      setName(''); setIcon('🎯'); setColor(PROTOCOL_COLORS[0]);
      setTod('morning'); setCustomTime('08:00');
      setActiveDays([0, 1, 2, 3, 4, 5, 6]); setSteps([newStep()]);
    }
    setNewLabel('');
  }, [visible, protocol?.id]);

  const addStep = () => {
    if (!newLabel.trim()) return;
    setSteps((s) => [...s, { id: `${Date.now()}-${Math.random()}`, label: newLabel.trim(), type: 'required' }]);
    setNewLabel('');
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  const toggleDayActive = (d: number) =>
    setActiveDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const save = () => {
    const validSteps = steps.filter((s) => s.label.trim());
    if (!name.trim() || validSteps.length === 0) return;
    onSave({
      name: name.trim(), icon, color, timeOfDay: tod,
      customTime: tod === 'custom' ? customTime : undefined,
      activeDays, steps: validSteps,
    });
  };

  const confirmArchive = () => {
    Alert.alert('Archive Protocol', 'This protocol will be hidden. Your streak history is preserved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => { onArchive?.(); onClose(); } },
    ]);
  };

  const inp = {
    backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    padding: 12, color: c.text, fontSize: 15,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <TouchableOpacity onPress={onClose}><Text style={{ color: c.textSecondary, fontSize: 16 }}>Cancel</Text></TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{protocol ? 'Edit Protocol' : 'New Protocol'}</Text>
          <TouchableOpacity onPress={save}><Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>Save</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Lbl text="Name" c={c} />
          <TextInput style={inp} value={name} onChangeText={setName} placeholder="Protocol name" placeholderTextColor={c.textMuted} />

          <Lbl text="Icon" c={c} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => setIcon(e)} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: icon === e ? c.primary : c.border, backgroundColor: icon === e ? c.primaryFaint : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Lbl text="Color" c={c} />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {PROTOCOL_COLORS.map((col) => (
              <TouchableOpacity key={col} onPress={() => setColor(col)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, borderWidth: 2.5, borderColor: color === col ? c.text : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {color === col && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          <Lbl text="Time of Day" c={c} />
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {TOD_OPTS.map((t) => (
              <TouchableOpacity key={t} onPress={() => setTod(t)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: tod === t ? c.primary : c.border, backgroundColor: tod === t ? c.primaryFaint : c.surface }}>
                <Text style={{ color: tod === t ? c.primary : c.textSecondary, fontSize: 13, fontWeight: '500' }}>{TOD_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tod === 'custom' && (
            <>
              <Lbl text="Time (HH:MM)" c={c} />
              <TextInput style={inp} value={customTime} onChangeText={setCustomTime} placeholder="08:00" placeholderTextColor={c.textMuted} keyboardType="numbers-and-punctuation" />
            </>
          )}

          <Lbl text="Active Days" c={c} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DAY_LETTERS.map((d, i) => {
              const on = activeDays.includes(i);
              return (
                <TouchableOpacity key={i} onPress={() => toggleDayActive(i)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: on ? c.primary : c.surface, borderWidth: 1, borderColor: on ? c.primary : c.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: on ? (c.isDark ? c.bg : '#fff') : c.textSecondary, fontSize: 12, fontWeight: '500' }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Lbl text="Steps" c={c} />
          {steps.map((step, i) => (
            <View key={step.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ gap: 1 }}>
                  <TouchableOpacity onPress={() => moveStep(i, -1)} disabled={i === 0} hitSlop={{ top: 6, bottom: 3, left: 6, right: 6 }}>
                    <Ionicons name="chevron-up" size={14} color={i === 0 ? c.textMuted : c.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveStep(i, 1)} disabled={i === steps.length - 1} hitSlop={{ top: 3, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="chevron-down" size={14} color={i === steps.length - 1 ? c.textMuted : c.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{ flex: 1, color: c.text, fontSize: 14 }}
                  value={step.label}
                  onChangeText={(lbl) => setSteps((s) => s.map((x, j) => j === i ? { ...x, label: lbl } : x))}
                  placeholder="Step description"
                  placeholderTextColor={c.textMuted}
                />
                <TouchableOpacity
                  onPress={() => setSteps((s) => s.map((x, j) => j === i ? { ...x, type: x.type === 'required' ? 'bonus' : 'required' } : x))}
                  style={{ backgroundColor: step.type === 'required' ? c.primaryFaint : '#F59E0B20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: step.type === 'required' ? c.primary + '60' : '#F59E0B60' }}
                >
                  <Text style={{ color: step.type === 'required' ? c.primary : '#F59E0B', fontSize: 10, fontWeight: '600' }}>{step.type === 'required' ? 'Req' : 'Bonus'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setSteps((s) => s.filter((_, j) => j !== i))} style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={20} color={c.error} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TextInput style={[inp, { flex: 1 }]} value={newLabel} onChangeText={setNewLabel} placeholder="Add a step…" placeholderTextColor={c.textMuted} onSubmitEditing={addStep} returnKeyType="done" />
            <TouchableOpacity onPress={addStep} style={{ backgroundColor: c.primaryFaint, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.primary + '60' }}>
              <Text style={{ color: c.primary, fontWeight: '600', fontSize: 16 }}>+</Text>
            </TouchableOpacity>
          </View>

          {protocol && onArchive && (
            <TouchableOpacity onPress={confirmArchive} style={{ marginTop: 32, backgroundColor: c.isDark ? '#3A1A1A' : '#FFF0F0', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.error + '40' }}>
              <Text style={{ color: c.error, fontSize: 15, fontWeight: '500' }}>Archive Protocol</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Lbl({ text, c }: { text: string; c: ThemeColors }) {
  return (
    <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 }}>
      {text}
    </Text>
  );
}
