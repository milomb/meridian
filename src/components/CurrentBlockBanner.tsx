import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, getCategoryColor, getCategoryBg } from '../theme/colors';
import { useLifeElementStore } from '../store/lifeElementStore';
import { TimeBlock, blockProgressPercent } from '../store/scheduleStore';

interface Props {
  block: TimeBlock;
}

export function CurrentBlockBanner({ block }: Props) {
  const c = useColors();
  const { elements: lifeElements } = useLifeElementStore();
  const [progress, setProgress] = useState(() => blockProgressPercent(block));

  useEffect(() => {
    const id = setInterval(() => setProgress(blockProgressPercent(block)), 30_000);
    return () => clearInterval(id);
  }, [block]);

  const catColor = getCategoryColor(block.category, lifeElements, c);
  const catBg = getCategoryBg(block.category, lifeElements, c);

  return (
    <View style={{
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: catColor + '40',
      backgroundColor: catBg,
      overflow: 'hidden',
    }}>
      <LinearGradient
        colors={[catColor + '20', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 }}>NOW</Text>
        <Text style={{ color: catColor, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {block.category}
        </Text>
      </View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '600', marginBottom: 2 }}>{block.title}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13, marginBottom: 12, fontWeight: '400' }}>
        {block.startTime} – {block.endTime}
      </Text>
      <View style={{
        height: 4,
        backgroundColor: c.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        <View style={{
          height: '100%',
          borderRadius: 2,
          backgroundColor: catColor,
          width: `${Math.round(progress * 100)}%`,
        }} />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '400' }}>
        {Math.round(progress * 100)}% complete
      </Text>
    </View>
  );
}
