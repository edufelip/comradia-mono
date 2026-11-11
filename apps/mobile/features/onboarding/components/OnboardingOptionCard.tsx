import { Pressable, StyleSheet, Text } from 'react-native';
import { DsFontFamily, getDsTheme, type DsColorScheme } from '@/constants/design-system';

type OnboardingOptionCardProps = {
  scheme: DsColorScheme;
  testID: string;
  /** Emoji shown in the tinted tile. */
  icon: string;
  /** The card's own colour: tints the tile and the selected border. */
  accent: string;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * The vibe card of S2 (`#tendGrid .tend`): icon tile, label and description.
 * Behaves as one radio option; the visible texts and the tinted accent carry the
 * selection, so colour alone is never the only signal.
 */
export function OnboardingOptionCard({
  scheme,
  testID,
  icon,
  accent,
  label,
  description,
  selected,
  onPress,
}: OnboardingOptionCardProps) {
  const ds = getDsTheme(scheme);

  return (
    <Pressable
      aria-checked={selected}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? `${accent}22` : ds.color.surface,
          borderColor: selected ? accent : ds.color.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      testID={testID}
    >
      <Text style={[styles.icon, { backgroundColor: `${accent}22` }]}>{icon}</Text>
      <Text style={[styles.label, { color: ds.color.textPrimary }]}>{label}</Text>
      <Text style={[styles.description, { color: ds.color.textSecondary }]}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 96,
    overflow: 'hidden',
    padding: 14,
    width: '100%',
  },
  icon: {
    borderRadius: 11,
    fontSize: 17,
    height: 34,
    lineHeight: 34,
    marginBottom: 10,
    overflow: 'hidden',
    textAlign: 'center',
    width: 34,
  },
  label: {
    fontFamily: DsFontFamily.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
