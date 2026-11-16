import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { DsChip } from '@/components/ds/primitives/DsChip';
import { DsSelectCard } from '@/components/ds/primitives/DsSelectCard';
import { DsStepProgress } from '@/components/ds/primitives/DsStepProgress';
import { DsSwitch } from '@/components/ds/primitives/DsSwitch';
import { DsTextField } from '@/components/ds/primitives/DsTextField';
import { getDsTheme } from '@/constants/design-system';

const light = getDsTheme('light');
const dark = getDsTheme('dark');

afterEach(() => jest.restoreAllMocks());

describe('DsChip', () => {
  it('is an unchecked checkbox by default and reports presses', async () => {
    const onPress = jest.fn();
    await render(
      <DsChip label="Cycling" onPress={onPress} scheme="light" selected={false} testID="chip" />,
    );

    const chip = screen.getByRole('checkbox', { name: 'Cycling' });
    expect(chip).not.toBeChecked();
    expect(chip).toBeEnabled();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can be a radio and shows its selected state with the accent fill', async () => {
    await render(
      <DsChip
        label="Friends"
        onPress={jest.fn()}
        role="radio"
        scheme="light"
        selected
        testID="chip"
      />,
    );

    const chip = screen.getByRole('radio', { name: 'Friends' });
    expect(chip).toBeChecked();
    expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
      backgroundColor: light.color.accentPrimary,
      borderColor: light.color.accentPrimary,
    });
    expect(screen.getByText('Friends')).toHaveStyle({ color: light.color.onAccent });
  });

  it('uses the surface fill when unselected, in both schemes', async () => {
    const view = await render(
      <DsChip label="Books" onPress={jest.fn()} scheme="light" selected={false} testID="chip" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('chip').props.style)).toMatchObject({
      backgroundColor: light.color.surface,
      borderColor: light.color.border,
    });

    await view.rerender(
      <DsChip label="Books" onPress={jest.fn()} scheme="dark" selected={false} testID="chip" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('chip').props.style)).toMatchObject({
      backgroundColor: dark.color.surface,
    });
  });

  it('keeps a 44 pt minimum height', async () => {
    await render(
      <DsChip label="Books" onPress={jest.fn()} scheme="light" selected={false} testID="chip" />,
    );

    expect(StyleSheet.flatten(screen.getByTestId('chip').props.style)).toMatchObject({
      minHeight: 44,
    });
  });

  it('is disabled with the disabled tokens and ignores presses', async () => {
    const onPress = jest.fn();
    await render(
      <DsChip
        disabled
        label="Cycling"
        onPress={onPress}
        scheme="light"
        selected={false}
        testID="chip"
      />,
    );

    const chip = screen.getByRole('checkbox', { name: 'Cycling' });
    expect(chip).toBeDisabled();
    expect(StyleSheet.flatten(chip.props.style)).toMatchObject({
      backgroundColor: light.color.disabledSurface,
      borderColor: light.color.disabledBorder,
    });
    expect(screen.getByText('Cycling')).toHaveStyle({ color: light.color.disabledText });
    await fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the emoji in the label but keeps it out of the accessible name', async () => {
    await render(
      <DsChip icon="🚲" label="Cycling" onPress={jest.fn()} scheme="light" selected={false} />,
    );

    expect(screen.getByText('🚲 Cycling')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Cycling');
  });

  it('plays the selection entrance only after a user selects it', async () => {
    const view = await render(
      <DsChip label="Cycling" onPress={jest.fn()} scheme="light" selected testID="chip" />,
    );
    expect(screen.queryByTestId('chip-selected-motion')).not.toBeOnTheScreen();

    await view.rerender(
      <DsChip label="Cycling" onPress={jest.fn()} scheme="light" selected={false} testID="chip" />,
    );
    await view.rerender(
      <DsChip label="Cycling" onPress={jest.fn()} scheme="light" selected testID="chip" />,
    );
    expect(screen.getByTestId('chip-selected-motion')).toBeOnTheScreen();
  });

  it('renders the selection entrance without a test id', async () => {
    const view = await render(
      <DsChip label="Cycling" onPress={jest.fn()} scheme="light" selected={false} />,
    );
    await view.rerender(<DsChip label="Cycling" onPress={jest.fn()} scheme="light" selected />);

    expect(screen.getByRole('checkbox', { name: 'Cycling' })).toBeChecked();
  });
});

describe('DsSwitch', () => {
  function Harness({ initial = false }: { initial?: boolean }) {
    const [value, setValue] = useState(initial);
    return (
      <DsSwitch
        accessibilityLabel="Union member"
        onValueChange={setValue}
        scheme="light"
        testID="toggle"
        value={value}
      />
    );
  }

  it('is a switch that toggles and exposes its checked state', async () => {
    await render(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'Union member' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(screen.getByRole('switch', { name: 'Union member' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Union member' }));
    expect(screen.getByRole('switch', { name: 'Union member' })).not.toBeChecked();
  });

  it('calls onValueChange with the next value', async () => {
    const onValueChange = jest.fn();
    await render(
      <DsSwitch
        accessibilityLabel="Union member"
        onValueChange={onValueChange}
        scheme="light"
        value
      />,
    );

    await fireEvent.press(screen.getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('colors the track by state and the thumb with the switch token', async () => {
    const view = await render(
      <DsSwitch
        accessibilityLabel="On"
        onValueChange={jest.fn()}
        scheme="light"
        testID="t"
        value
      />,
    );
    const thumb = StyleSheet.flatten(screen.getByTestId('t.thumb').props.style);
    expect(thumb).toMatchObject({
      backgroundColor: light.color.switchThumb,
      width: 20,
      height: 20,
    });

    await view.rerender(
      <DsSwitch
        accessibilityLabel="On"
        onValueChange={jest.fn()}
        scheme="light"
        testID="t"
        value={false}
      />,
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('moves the thumb at once when Reduce Motion is on', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(<Harness />);

    expect(StyleSheet.flatten(screen.getByTestId('toggle.thumb').props.style)).toMatchObject({
      transform: [{ translateX: 0 }],
    });
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(StyleSheet.flatten(screen.getByTestId('toggle.thumb').props.style)).toMatchObject({
      transform: [{ translateX: 16 }],
    });
  });

  it('animates the thumb with the shared timing when motion is allowed', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(<Harness />);
    await fireEvent.press(screen.getByTestId('toggle'));

    expect(timing).toHaveBeenCalled();
  });

  it('uses a labelled row as the whole target and takes its name from the label', async () => {
    const onValueChange = jest.fn();
    await render(
      <DsSwitch label="Show my union" onValueChange={onValueChange} scheme="dark" value={false} />,
    );

    expect(screen.getByText('Show my union')).toBeOnTheScreen();
    const row = screen.getByRole('switch', { name: 'Show my union' });
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      flexDirection: 'row',
      minHeight: 44,
    });
    await fireEvent.press(row);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('is disabled with the disabled tokens and ignores presses', async () => {
    const onValueChange = jest.fn();
    await render(
      <DsSwitch
        accessibilityLabel="Locked"
        disabled
        label="Locked"
        onValueChange={onValueChange}
        scheme="light"
        value
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Locked' });
    expect(toggle).toBeDisabled();
    expect(screen.getByText('Locked')).toHaveStyle({ color: light.color.disabledText });
    await fireEvent.press(toggle);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('DsSelectCard', () => {
  const props = {
    accent: '#2F8F5B',
    description: 'Trails, bikes, picnics',
    icon: '🌿',
    label: 'Outdoorsy',
    onPress: jest.fn(),
    scheme: 'light' as const,
    testID: 'card',
  };

  it('is a radio named by its label and description', async () => {
    await render(<DsSelectCard {...props} selected={false} />);

    const card = screen.getByRole('radio', { name: 'Outdoorsy. Trails, bikes, picnics' });
    expect(card).not.toBeChecked();
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: light.color.surface,
      borderColor: light.color.border,
      borderWidth: 1.5,
    });
  });

  it('reports presses', async () => {
    const onPress = jest.fn();
    await render(<DsSelectCard {...props} onPress={onPress} selected={false} />);

    await fireEvent.press(screen.getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('tints and outlines the card with its accent when selected', async () => {
    await render(<DsSelectCard {...props} selected />);

    const card = screen.getByRole('radio');
    expect(card).toBeChecked();
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: '#2F8F5B22',
      borderColor: '#2F8F5B',
    });
  });

  it('plays the icon entrance only after a user selects it', async () => {
    const view = await render(<DsSelectCard {...props} selected />);
    expect(screen.queryByTestId('card-selected-motion')).not.toBeOnTheScreen();

    await view.rerender(<DsSelectCard {...props} selected={false} />);
    await view.rerender(<DsSelectCard {...props} selected />);
    expect(screen.getByTestId('card-selected-motion')).toBeOnTheScreen();
  });

  it('renders the icon entrance without a test id', async () => {
    const view = await render(<DsSelectCard {...props} selected={false} testID={undefined} />);
    await view.rerender(<DsSelectCard {...props} selected testID={undefined} />);

    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('is disabled with the disabled tokens and ignores presses', async () => {
    const onPress = jest.fn();
    await render(<DsSelectCard {...props} disabled onPress={onPress} selected={false} />);

    const card = screen.getByRole('radio');
    expect(card).toBeDisabled();
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: light.color.disabledSurface,
      borderColor: light.color.disabledBorder,
    });
    await fireEvent.press(card);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('DsStepProgress', () => {
  it('shows the label it is given and no back button without onBack', async () => {
    await render(
      <DsStepProgress label="Step 2 of 3" scheme="light" step={2} testID="progress" total={3} />,
    );

    expect(screen.getByTestId('progress')).toHaveTextContent('Step 2 of 3');
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('draws one segment per step, filling the current one with motion', async () => {
    await render(
      <DsStepProgress label="Step 2 of 4" scheme="light" step={2} testID="progress" total={4} />,
    );

    // The bar is decorative, so only the filling segment is reachable by test id.
    expect(
      screen.getByTestId('progress-motion', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId('progress-motion', { includeHiddenElements: true })).toHaveLength(
      1,
    );
  });

  it('fills the current segment at once when Reduce Motion is on', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <DsStepProgress label="Step 1 of 3" scheme="dark" step={1} testID="progress" total={3} />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('progress-motion', { includeHiddenElements: true }).props.style,
      ),
    ).toMatchObject({ transform: [{ scaleX: 1 }] });
  });

  it('renders the segments without a test id', async () => {
    await render(<DsStepProgress label="Step 1 of 2" scheme="light" step={1} total={2} />);

    expect(screen.getByText('Step 1 of 2')).toBeOnTheScreen();
  });

  it('offers a labelled back button when onBack is given', async () => {
    const onBack = jest.fn();
    await render(
      <DsStepProgress
        backLabel="Go back"
        backTestID="back"
        label="Step 2 of 3"
        onBack={onBack}
        scheme="light"
        step={2}
        total={3}
      />,
    );

    const back = screen.getByRole('button', { name: 'Go back' });
    expect(screen.getByTestId('back')).toBe(back);
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('DsTextField', () => {
  const light = getDsTheme('light');

  function Harness(props: Partial<React.ComponentProps<typeof DsTextField>>) {
    const [value, setValue] = useState('');
    return (
      <DsTextField
        label="First name"
        onChangeText={setValue}
        scheme="light"
        testID="field"
        value={value}
        {...props}
      />
    );
  }

  it('takes its accessible name from the label and reports typing', async () => {
    const onChangeText = jest.fn();
    await render(
      <DsTextField
        label="First name"
        onChangeText={onChangeText}
        placeholder="Rosa"
        scheme="light"
        testID="field"
        value=""
      />,
    );

    expect(screen.getByText('First name')).toBeOnTheScreen();
    const input = screen.getByTestId('field');
    expect(input).toHaveAccessibleName('First name');
    expect(input).toHaveProp('placeholder', 'Rosa');
    await fireEvent.changeText(input, 'Rosa');
    expect(onChangeText).toHaveBeenCalledWith('Rosa');
  });

  it('uses accessibilityLabel instead of the label when given, and works without a label', async () => {
    await render(<Harness accessibilityLabel="Phone number" label={undefined} />);

    expect(screen.queryByTestId('field-label')).not.toBeOnTheScreen();
    expect(screen.getByTestId('field')).toHaveAccessibleName('Phone number');
  });

  it('shows the helper text, and the error replaces it', async () => {
    const view = await render(<Harness helperText="As on your ID" />);
    expect(screen.getByText('As on your ID')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();

    await view.rerender(<Harness errorText="Enter your name" helperText="As on your ID" />);
    expect(screen.queryByText('As on your ID')).not.toBeOnTheScreen();
    expect(within(screen.getByRole('alert')).getByText('Enter your name')).toBeOnTheScreen();
  });

  it('turns the row border red on error', async () => {
    await render(<Harness errorText="Enter your name" />);

    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      borderColor: light.color.danger,
      borderWidth: 1.5,
    });
  });

  it('draws the focus border on the row, not the input, and calls the focus handlers', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<Harness onBlur={onBlur} onFocus={onFocus} />);

    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      borderColor: light.color.borderStrong,
      borderWidth: 1,
    });
    await fireEvent(screen.getByTestId('field'), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      borderColor: light.color.accentPrimary,
      borderWidth: 1.5,
    });
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style)).toMatchObject({
      outlineWidth: 0,
    });
    expect(StyleSheet.flatten(screen.getByTestId('field.motion').props.style)).toMatchObject({
      transform: [{ scale: 1.006 }],
    });
    await fireEvent(screen.getByTestId('field'), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      borderColor: light.color.borderStrong,
    });
  });

  it('does not nudge the row on focus when Reduce Motion is on', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(<Harness />);

    await fireEvent(screen.getByTestId('field'), 'focus');
    expect(StyleSheet.flatten(screen.getByTestId('field.motion').props.style)).toMatchObject({
      transform: [{ scale: 1 }],
    });
  });

  it('renders a prefix and a suffix inside the row', async () => {
    await render(<Harness prefix={<Text>+55</Text>} suffix={<Text>kg</Text>} />);

    const row = screen.getByTestId('field.row');
    expect(row).toContainElement(screen.getByText('+55'));
    expect(row).toContainElement(screen.getByText('kg'));
  });

  it('is disabled: not editable, with the disabled tokens', async () => {
    await render(<Harness disabled />);

    const input = screen.getByTestId('field');
    expect(input).toHaveProp('editable', false);
    expect(input).toBeDisabled();
    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      backgroundColor: light.color.disabledSurface,
      borderColor: light.color.disabledBorder,
    });
  });

  it('is read-only: not editable, with the muted fill and read-only text color', async () => {
    await render(<Harness readOnly value="Rosa" />);

    const input = screen.getByTestId('field');
    expect(input).toHaveProp('editable', false);
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      color: light.color.readOnlyText,
    });
    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      backgroundColor: light.color.surfaceMuted,
    });
  });

  it('is multiline with a taller row', async () => {
    await render(<Harness multiline />);

    expect(screen.getByTestId('field')).toHaveProp('multiline', true);
    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      alignItems: 'flex-start',
      minHeight: 96,
    });
  });

  it('keeps the row at least 52 high with the input type size', async () => {
    await render(<Harness />);

    expect(StyleSheet.flatten(screen.getByTestId('field.row').props.style)).toMatchObject({
      minHeight: 52,
    });
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style)).toMatchObject({
      fontSize: 15,
    });
  });

  it('renders without a test id', async () => {
    await render(
      <DsTextField
        errorText="Bad"
        helperText="Ignored"
        label="Name"
        onChangeText={jest.fn()}
        scheme="dark"
        value=""
      />,
    );

    expect(within(screen.getByRole('alert')).getByText('Bad')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
  });

  it('shows helper text without a test id', async () => {
    await render(
      <DsTextField helperText="Help" onChangeText={jest.fn()} scheme="light" value="" />,
    );

    expect(screen.getByText('Help')).toBeOnTheScreen();
  });
});
