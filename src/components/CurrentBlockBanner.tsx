import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { TimeBlock, blockProgressPercent } from '../store/scheduleStore';

interface Props {
  block: TimeBlock;
}

export function CurrentBlockBanner({ block }: Props) {
  const [progress, setProgress] = useState(() => blockProgressPercent(block));

  useEffect(() => {
    const id = setInterval(() => {
      setProgress(blockProgressPercent(block));
    }, 30_000);
    return () => clearInterval(id);
  }, [block]);

  const catColor = colors.categories[block.category];
  const catBg = colors.categoryBg[block.category];

  return (
    <View style={[styles.container, { backgroundColor: catBg, borderColor: catColor + '40' }]}>
      <LinearGradient
        colors={[catColor + '20', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.label}>NOW</Text>
        <Text style={[styles.category, { color: catColor }]}>{block.category.toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>{block.title}</Text>
      <Text style={styles.time}>
        {block.startTime} – {block.endTime}
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress * 100)}%`, backgroundColor: catColor },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{Math.round(progress * 100)}% complete</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
