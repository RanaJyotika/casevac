/**
 * Date and time fields backed by Android's native pickers
 * (@react-native-community/datetimepicker). Times are shown and picked on a
 * 12-hour clock with AM/PM; values are stored as YYYY-MM-DD and HH:mm.
 * Large targets for gloved use; a "Now" shortcut fills the current value.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  combine,
  formatDateLabel,
  formatTime12,
  toDateValue,
  toTimeValue,
} from '../services/evacuation/assessment';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import { Icon } from './Icon';

type Mode = 'date' | 'time';

/** Opens the native picker; resolves with the picked Date or null if dismissed. */
export function openPicker(
  mode: Mode,
  value: Date,
  maximumDate?: Date,
): Promise<Date | null> {
  return new Promise(resolve => {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: false,
      maximumDate: mode === 'date' ? maximumDate : undefined,
      onChange: (event, date) => {
        resolve(event.type === 'set' && date ? date : null);
      },
    });
  });
}

function PickerField({
  label,
  text,
  placeholder,
  icon,
  onPress,
  onNow,
  error,
}: {
  label: string;
  text: string | null;
  placeholder: string;
  icon: 'calendar' | 'clock';
  onPress: () => void;
  onNow?: () => void;
  error?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: text ?? 'Not set' }}
          style={({ pressed }) => [
            styles.field,
            error ? styles.fieldError : null,
            pressed && styles.pressed,
          ]}
        >
          <Icon name={icon} size={22} color={colors.primary} />
          <Text
            style={[styles.value, !text && styles.placeholder]}
            numberOfLines={1}
          >
            {text ?? placeholder}
          </Text>
        </Pressable>
        {onNow ? (
          <Pressable
            onPress={onNow}
            accessibilityRole="button"
            accessibilityLabel={`${label}: now`}
            style={({ pressed }) => [styles.now, pressed && styles.pressed]}
          >
            <Text style={styles.nowText}>Now</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  error,
}: {
  label: string;
  /** YYYY-MM-DD or null */
  value: string | null;
  onChange: (value: string) => void;
  maximumDate?: Date;
  error?: string;
}) {
  const open = async () => {
    const picked = await openPicker(
      'date',
      combine(value, null) ?? new Date(),
      maximumDate,
    );
    if (picked) {
      onChange(toDateValue(picked));
    }
  };
  return (
    <PickerField
      label={label}
      text={value ? formatDateLabel(value) : null}
      placeholder="Select date"
      icon="calendar"
      onPress={open}
      onNow={() => onChange(toDateValue(new Date()))}
      error={error}
    />
  );
}

export function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  /** HH:mm or null */
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
}) {
  const open = async () => {
    const base = new Date();
    if (value) {
      const [h, m] = value.split(':').map(Number);
      base.setHours(h, m, 0, 0);
    }
    const picked = await openPicker('time', base);
    if (picked) {
      onChange(toTimeValue(picked));
    }
  };
  return (
    <PickerField
      label={label}
      text={value ? formatTime12(value) : null}
      placeholder="Select time"
      icon="clock"
      onPress={open}
      onNow={() => onChange(toTimeValue(new Date()))}
      error={error}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  fieldError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  value: {
    ...typography.input,
    flexShrink: 1,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.placeholder,
  },
  now: {
    minHeight: layout.inputHeight,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  nowText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  error: {
    ...typography.helper,
    fontWeight: '700',
    color: colors.error,
  },
});
