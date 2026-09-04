import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { getTierForAmount } from '../constants/gifts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// Reusable pieces -- each gift tier composes these differently
// rather than every tier being the same box with a new color.
// ============================================================

// A single dot that bursts outward from its parent's origin point,
// used by both Fireworks (multiple small bursts) and Supernova (one big one).
function Particle({ angle, distance, color, delay, size = 8, duration = 900 }: {
  angle: number; distance: number; color: string; delay: number; size?: number; duration?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] });
  const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

// One firework "pop" -- a ring of particles radiating from a point.
function FireworkBurst({ x, y, delay, colors }: { x: number; y: number; delay: number; colors: string[] }) {
  const particles = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      angle: (i / 14) * Math.PI * 2 + Math.random() * 0.3,
      distance: 55 + Math.random() * 35,
      color: colors[i % colors.length],
    }))
  ).current;

  return (
    <View style={[styles.originPoint, { left: x, top: y }]} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} angle={p.angle} distance={p.distance} color={p.color} delay={delay} />
      ))}
    </View>
  );
}

// A single coin drifting down the screen -- Golden Rain is many of these
// with staggered delays and randomized drift/rotation.
function FallingCoin({ startX, delay, duration, drift }: { startX: number; delay: number; duration: number; drift: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-40, SCREEN_HEIGHT * 0.65] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${drift > 0 ? 360 : -360}deg`] });

  return (
    <Animated.Text
      pointerEvents="none"
      style={{ position: 'absolute', left: startX, fontSize: 22, opacity, transform: [{ translateY }, { translateX }, { rotate }] }}
    >
      🪙
    </Animated.Text>
  );
}

// Expanding rings for Ripple -- like a coin dropped in water.
function RippleRings({ color }: { color: string }) {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    rings.forEach((ring, i) => {
      ring.setValue(0);
      Animated.sequence([
        Animated.delay(i * 220),
        Animated.timing(ring, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
  }, []);

  return (
    <View style={styles.animCenterContainer} pointerEvents="none">
      {rings.map((ring, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: 50,
            borderWidth: 3,
            borderColor: color,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] }) }],
          }}
        />
      ))}
    </View>
  );
}

// ============================================================
// Main component
// ============================================================

type DonationAnimationProps = {
  // comboKey is unique per *streak session* (same sender+tier+receiver,
  // freshly minted whenever the combo window lapses) -- comboCount rising
  // with the same key means "same streak, one more hit"; a new key means
  // "fresh gift, play the full entrance from scratch."
  donation: { amount: number; receiver: string; comboKey: string; comboCount: number } | null;
  onComplete: () => void;
};

export default function DonationAnimation({ donation, onComplete }: DonationAnimationProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const comboBadgeScale = useRef(new Animated.Value(1)).current;

  const [rainCoins, setRainCoins] = useState<any[]>([]);
  const [fireworkBursts, setFireworkBursts] = useState<any[]>([]);
  const [confettiParticles, setConfettiParticles] = useState<any[]>([]);
  const [milestoneBurst, setMilestoneBurst] = useState<any[]>([]);
  const [displayCount, setDisplayCount] = useState(1);

  const prevComboKeyRef = useRef<string | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tier = donation ? getTierForAmount(donation.amount) : null;

  useEffect(() => {
    if (!donation || !tier) return;

    const isNewCombo = donation.comboKey !== prevComboKeyRef.current;
    prevComboKeyRef.current = donation.comboKey;
    setDisplayCount(donation.comboCount);

    // Total on-screen time per tier -- bigger gifts linger longer. Reused
    // both for the initial entrance's hold time and to re-arm the exit on
    // every combo increment, so a fast streak just keeps pushing it out.
    const totalDuration =
      tier.animation === 'spark' ? 1200 :
      tier.animation === 'ripple' ? 1800 :
      tier.animation === 'rain' ? 2800 :
      tier.animation === 'fireworks' ? 3200 :
      tier.animation === 'shake' ? 4100 :
      5500; // supernova

    if (isNewCombo) {
      opacity.setValue(0);
      scale.setValue(0.5);
      translateY.setValue(50);
      shakeX.setValue(0);
      flash.setValue(0);
      comboBadgeScale.setValue(1);

      if (tier.animation === 'rain') {
        setRainCoins(Array.from({ length: 10 }, (_, i) => ({
          id: i,
          startX: Math.random() * (SCREEN_WIDTH - 40),
          delay: Math.random() * 800,
          fallDuration: 1800 + Math.random() * 600,
          drift: (Math.random() - 0.5) * 80,
        })));
      } else {
        setRainCoins([]);
      }

      if (tier.animation === 'fireworks') {
        setFireworkBursts([
          { x: SCREEN_WIDTH * 0.28, y: SCREEN_HEIGHT * 0.35, delay: 0 },
          { x: SCREEN_WIDTH * 0.72, y: SCREEN_HEIGHT * 0.3, delay: 400 },
          { x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.45, delay: 850 },
        ]);
      } else {
        setFireworkBursts([]);
      }

      if (tier.animation === 'supernova') {
        setConfettiParticles(Array.from({ length: 26 }, (_, i) => ({
          id: i,
          angle: Math.random() * Math.PI * 2,
          distance: 110 + Math.random() * 160,
          color: [tier.color, '#FFD700', '#00f2ea', '#fff'][i % 4],
          delay: Math.random() * 300,
        })));
      } else {
        setConfettiParticles([]);
      }

      const entranceScale = tier.animation === 'supernova' ? 1.3 : tier.animation === 'shake' ? 1.4 : 1;

      Animated.parallel([
        Animated.spring(scale, { toValue: entranceScale, friction: 3, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      if (tier.animation === 'shake') {
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(shakeX, { toValue: 12, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -12, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }

      if (tier.animation === 'supernova') {
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]).start();
      }
    } else {
      // Same streak, one more hit -- pulse the xN badge instead of
      // re-triggering the whole entrance (rain/fireworks/confetti already in
      // flight are left alone rather than respawned).
      Animated.sequence([
        Animated.spring(comboBadgeScale, { toValue: 1.35, friction: 3, useNativeDriver: true }),
        Animated.spring(comboBadgeScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }

    // Bonus flourish every 5 hits in a streak (x5, x10, x20...) -- even a
    // Spark streak gets to feel like a bigger moment.
    if (donation.comboCount > 1 && donation.comboCount % 5 === 0) {
      setMilestoneBurst(Array.from({ length: 18 }, (_, i) => ({
        id: `${donation.comboKey}-${donation.comboCount}-${i}`,
        angle: (i / 18) * Math.PI * 2,
        distance: 90 + Math.random() * 70,
        color: [tier.color, '#FFD700', '#fff'][i % 3],
      })));
    }

    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -50, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        scale.setValue(0.5);
        translateY.setValue(50);
        setMilestoneBurst([]);
        prevComboKeyRef.current = null;
        onComplete();
      });
    }, totalDuration - 600);
  }, [donation]);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  if (!donation || !tier) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tier.animation === 'supernova' && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: tier.color, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]}
        />
      )}

      {(tier.animation === 'shake' || tier.animation === 'supernova') && (
        <Animated.View style={[styles.neonBorder, { opacity, borderColor: tier.color, borderWidth: tier.animation === 'supernova' ? 12 : 8 }]} />
      )}

      {tier.animation === 'ripple' && <RippleRings color={tier.color} />}

      {rainCoins.map((c) => (
        <FallingCoin key={c.id} startX={c.startX} delay={c.delay} duration={c.fallDuration} drift={c.drift} />
      ))}

      {fireworkBursts.map((b, i) => (
        <FireworkBurst key={i} x={b.x} y={b.y} delay={b.delay} colors={[tier.color, '#FFD700', '#fff']} />
      ))}

      {confettiParticles.length > 0 && (
        <View style={[styles.originPoint, { left: SCREEN_WIDTH / 2, top: SCREEN_HEIGHT / 2 }]} pointerEvents="none">
          {confettiParticles.map((p) => (
            <Particle key={p.id} angle={p.angle} distance={p.distance} color={p.color} delay={p.delay} size={10} duration={1400} />
          ))}
        </View>
      )}

      {milestoneBurst.length > 0 && (
        <View style={[styles.originPoint, { left: SCREEN_WIDTH / 2, top: SCREEN_HEIGHT / 2 }]} pointerEvents="none">
          {milestoneBurst.map((p) => (
            <Particle key={p.id} angle={p.angle} distance={p.distance} color={p.color} delay={0} size={9} duration={800} />
          ))}
        </View>
      )}

      <View style={styles.animCenterContainer}>
        <Animated.View style={[styles.animBox, { opacity, transform: [{ scale }, { translateY }, { translateX: shakeX }], shadowColor: tier.color }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tier.glow, borderRadius: 20, shadowColor: tier.color, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 }]} />

          {displayCount > 1 && (
            <Animated.View style={[styles.comboBadge, { borderColor: tier.color, transform: [{ scale: comboBadgeScale }] }]}>
              <Text style={[styles.comboBadgeText, { color: tier.color }]}>x{displayCount}</Text>
            </Animated.View>
          )}

          <Text style={styles.tierIcon}>{tier.icon}</Text>
          <Text style={[styles.animTitle, { color: tier.color, textShadowColor: tier.color }]}>{tier.name.toUpperCase()}!</Text>
          <Text style={styles.animSub}>You sent <Text style={{ fontWeight: 'bold', color: '#fff' }}>{donation.amount} 🪙</Text> to {donation.receiver}!</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  originPoint: { position: 'absolute', width: 0, height: 0 },
  neonBorder: { ...StyleSheet.absoluteFill, borderWidth: 8, zIndex: 998 },
  animCenterContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  animBox: { padding: 30, alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 30 },
  tierIcon: { fontSize: 40, marginBottom: 6 },
  animTitle: { fontSize: 32, fontWeight: '900', fontStyle: 'italic', marginBottom: 10, textShadowRadius: 15, textShadowOffset: { width: 0, height: 0 } },
  animSub: { color: '#ccc', fontSize: 18, fontWeight: '600' },
  comboBadge: {
    position: 'absolute',
    top: -14,
    right: -14,
    backgroundColor: '#000',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1000,
  },
  comboBadgeText: { fontSize: 16, fontWeight: '900' },
});
