import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { Habit, useHabitStore } from '../store/habitStore';

interface Props {
  habit: Habit;
}

export function HabitChip({ habit }: Props) {
  const { toggleToday, isCompletedToday } = useHabitStore();
  const done = isCompletedToday(habit);

  const handlePress = () => {
    Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    toggleToday(habit.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        done && styles.chipDone,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={styles.emoji}>{habit.emoji}</Text>
      <Text style={[styles.name, done && styles.nameDone]}>{habit.name}</Text>
      {habit.streak > 1 && (
        <View style={styles.streak}>
          <Text style={styles.streakText}>{habit.streak}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipDone: {
    backgroundColor: colors.primaryFaint,
    borderColor: colors.primary + '60',
  },
  chipPressed: {
    opacity: 0.7,
  },
  emoji: {
    fontSize: 16,
  },
  name: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  nameDone: {
    color: colors.primary,
  },
  streak: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  streakText: {
    color: colors.bg,
    fontSize: 10,
    fontWeight: '700',
  },
});
