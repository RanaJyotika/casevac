import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';

interface FormFieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  ref?: React.Ref<TextInputInstance>;
  /** Decorative icon inside the field, before the text. */
  leading?: React.ReactNode;
  /** Control inside the field, after the text (e.g. show/hide password). */
  trailing?: React.ReactNode;
}

/**
 * Labelled text input. The visible label is always shown; placeholders are
 * supplemental only (UI_DESIGN_GUIDELINES.md §3).
 */
export function FormField({
  label,
  helper,
  error,
  required = false,
  ref,
  onFocus,
  onBlur,
  leading,
  trailing,
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const adorned = Boolean(leading || trailing);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View
        style={
          adorned
            ? [
                styles.adorned,
                focused && styles.adornedFocused,
                hasError && styles.inputError,
              ]
            : undefined
        }
      >
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={helper}
          placeholderTextColor={colors.placeholder}
          onFocus={event => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={
            adorned
              ? styles.adornedInput
              : [
                  styles.input,
                  focused && styles.inputFocused,
                  hasError && styles.inputError,
                ]
          }
          {...inputProps}
        />
        {trailing}
      </View>
      {hasError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
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
  required: {
    color: colors.error,
  },
  input: {
    ...typography.input,
    minHeight: layout.inputHeight,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    paddingHorizontal: 13,
  },
  inputError: {
    borderColor: colors.error,
  },
  adorned: {
    minHeight: layout.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  adornedFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    margin: -1,
  },
  leading: {
    paddingLeft: spacing.md,
  },
  adornedInput: {
    ...typography.input,
    flex: 1,
    minHeight: layout.inputHeight - 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  helper: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  error: {
    ...typography.helper,
    color: colors.error,
    fontWeight: '500',
  },
});
