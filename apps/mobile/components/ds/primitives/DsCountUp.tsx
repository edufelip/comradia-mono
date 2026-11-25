import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';

type DsCountUpProps = {
  /** Final value; the count runs from `from` to it. */
  value: number;
  /** Where the count starts (e.g. the last balance the person saw). */
  from?: number;
  /** BCP-47 tag for grouping digits in the default format (`pt-BR` gives 1.240). Pass the active locale. */
  locale?: string;
  /** Formats every intermediate and the final value; overrides the locale grouping. */
  format?: (value: number) => string;
  /** A `DsTypography` style; the count is always tabular so the digits do not jitter. */
  textStyle: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * A number that counts from `from` to `value` over `countUp` 600 ms, eased like the
 * celebration moments (Easing.out(cubic), as in `MatchCelebration`). With Reduce Motion it
 * renders the final value at once, and the spoken label is always the final value only —
 * the intermediate counts are never announced.
 */
export function DsCountUp({ value, from = 0, locale, format, textStyle, testID }: DsCountUpProps) {
  const reduceMotion = useReducedMotion();
  const formatter = useMemo(
    () => format ?? ((amount: number) => new Intl.NumberFormat(locale).format(amount)),
    [format, locale],
  );
  // An inline `format` from a re-rendering parent must not restart the count, so the loop
  // reads the latest formatter through a ref instead of depending on its identity.
  const formatterRef = useRef(formatter);
  formatterRef.current = formatter;
  const [display, setDisplay] = useState(() => formatterRef.current(reduceMotion ? value : from));

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(formatterRef.current(value));
      return;
    }

    let frame = 0;
    let started = 0;
    const step = (now: number) => {
      started = started || now;
      const t = Math.min(1, (now - started) / DS_MOTION.duration.countUp);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(formatterRef.current(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [from, reduceMotion, value]);

  return (
    <Text
      accessibilityLabel={formatterRef.current(value)}
      style={[textStyle, styles.tabular]}
      testID={testID}
    >
      {display}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
