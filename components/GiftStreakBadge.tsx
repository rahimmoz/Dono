import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

type Streak = { tierName: string; icon: string; color: string; count: number } | null;

// Minimized version of the gift streak, for everyone watching the active
// video *other* than the sender (they get the full DonationAnimation
// instead). Purely presentational -- index.tsx owns the realtime
// subscription and just hands this component whatever the latest streak is.
export default function GiftStreakBadge({ streak, topOffset = 0 }: { streak: Streak; topOffset?: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!streak) {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      lastCountRef.current = 0;
      return;
    }

    if (lastCountRef.current === 0) {
      // First appearance -- pop in.
      scale.setValue(0.6);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else if (streak.count > lastCountRef.current) {
      // Bumped -- a quick pulse reads better here than a full pop-in replay.
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.25, friction: 3, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }

    lastCountRef.current = streak.count;
  }, [streak]);

  if (!streak) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badge,
        { top: topOffset + 60, borderColor: streak.color, opacity, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.icon}>{streak.icon}</Text>
      <Text style={[styles.count, { color: streak.color }]}>x{streak.count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 997,
  },
  icon: { fontSize: 16, marginRight: 4 },
  count: { fontSize: 14, fontWeight: '800' },
});
