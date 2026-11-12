import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface FormFieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  ref?: React.Ref<TextInputInstance>;
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
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
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
        style={[
          styles.input,
          focused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
        {...inputProps}
      />
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
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    paddingHorizontal: 13,
  },
  inputError: {
    borderColor: colors.error,
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
