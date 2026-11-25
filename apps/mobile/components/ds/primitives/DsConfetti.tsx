import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DsAchievementTier, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

const PIECE_COUNT = 40;
/** The prototype's step count: 900 ms at ~60 fps, so the physics below are frame-based. */
const TOTAL_FRAMES = 54;

/** Deterministic per-piece values, so a render never jumps around between frames. */
function randomFor(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

type PieceSpec = {
  driftX: number;
  riseY: number;
  spin: number;
  spinStart: number;
  width: number;
  height: number;
};

const PIECES: PieceSpec[] = Array.from({ length: PIECE_COUNT }, (_, index) => ({
  driftX: (randomFor(index, 1) - 0.5) * 6,
  riseY: -randomFor(index, 2) * 6 - 2,
  spin: (randomFor(index, 3) - 0.5) * 0.25,
  spinStart: randomFor(index, 4) * 6,
  width: 4 + randomFor(index, 5) * 4,
  height: 6 + randomFor(index, 6) * 5,
}));

type ConfettiPieceProps = {
  progress: { value: number };
  originX: number;
  originY: number;
  spec: PieceSpec;
  color: string;
  testID?: string;
};

function ConfettiPiece({ progress, originX, originY, spec, color, testID }: ConfettiPieceProps) {
  const style = useAnimatedStyle(() => {
    const frames = TOTAL_FRAMES * progress.value;
    return {
      opacity: (1 - progress.value) ** 3,
      transform: [
        { translateX: originX + spec.driftX * frames },
        { translateY: originY + spec.riseY * frames + 0.1 * frames * frames },
        { rotate: `${spec.spinStart + spec.spin * frames}rad` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: color, width: spec.width, height: spec.height },
        style,
      ]}
      testID={testID}
    />
  );
}

type DsConfettiProps = {
  scheme: DsColorScheme;
  /** Where the burst starts, as fractions of the layer's size. */
  origin?: { x: number; y: number };
  testID?: string;
};

/**
 * A one-shot celebration: 40 pieces rise from `origin` and fade out over `celebrate` 900 ms.
 * Mount it to play; unmounting stops it. Nothing loops and nothing flashes. Renders nothing
 * under Reduce Motion, never takes touches and stays out of the accessibility tree.
 */
export function DsConfetti({ scheme, origin = { x: 0.5, y: 0.3 }, testID }: DsConfettiProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withTiming(1, {
      duration: DS_MOTION.duration.celebrate,
      easing: Easing.bezier(...DS_MOTION.easing.easeOut),
    });
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  if (reduceMotion) return null;

  const colors = [
    ds.color.accentPrimary,
    ds.color.accentWarm,
    DsAchievementTier.gold.base,
    ds.color.success,
    ds.color.accentCyan,
  ];
  const originX = origin.x * size.width;
  const originY = origin.y * size.height;

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      pointerEvents="none"
      style={styles.layer}
      testID={testID}
    >
      {size.width > 0
        ? PIECES.map((spec, index) => (
            <ConfettiPiece
              color={colors[index % colors.length]}
              key={index}
              originX={originX}
              originY={originY}
              progress={progress}
              spec={spec}
              testID={testID ? `${testID}-piece` : undefined}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  piece: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
});
