/**
 * Enter Patient ID manually (M03 fallback) — for when the wristband cannot
 * be scanned. Looks the ID up on this tablet only; exact matches only.
 */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import {
  lookupPatientById,
  type ManualIdentification,
} from '../services/identity/manualLookup';
import type { IdentityDirectory } from '../services/identity/types';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import { FormField } from './FormField';
import { Notice } from './Notice';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface ManualPatientIdDialogProps {
  visible: boolean;
  directory: IdentityDirectory;
  onCancel: () => void;
  onFound: (result: ManualIdentification) => void;
  onStartTemporary: () => void;
}

export function ManualPatientIdDialog({
  visible,
  directory,
  onCancel,
  onFound,
  onStartTemporary,
}: ManualPatientIdDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue('');
      setError(null);
      setNotFound(null);
      setSearching(false);
    }
  }, [visible]);

  const search = async () => {
    if (searching) {
      return;
    }
    setNotFound(null);
    setSearching(true);
    try {
      const result = await lookupPatientById(value, directory);
      if (result.ok) {
        onFound(result);
      } else if (result.reason === 'EMPTY') {
        setError('Enter the Patient ID.');
      } else {
        setNotFound(result.enteredId);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      supportedOrientations={['landscape', 'portrait']}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            Enter Patient ID
          </Text>
          <Text style={styles.body}>
            Use this when the wristband cannot be scanned. The ID is looked up
            on this tablet only; manual entry does not verify the wristband.
          </Text>

          <FormField
            label="Patient ID"
            value={value}
            onChangeText={text => {
              setValue(text);
              setError(null);
              setNotFound(null);
            }}
            placeholder="e.g. PAT-00001"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={search}
            error={error ?? undefined}
            editable={!searching}
          />

          {notFound ? (
            <Notice
              tone="warning"
              title="PATIENT NOT FOUND ON THIS TABLET"
              message={`No patient with ID ${notFound}. Check the ID, or start a temporary evacuation if the casualty cannot be identified.`}
            />
          ) : null}

          <View style={styles.actions}>
            <SecondaryButton
              title="Cancel"
              onPress={onCancel}
              style={styles.action}
            />
            {notFound ? (
              <SecondaryButton
                title="Temporary evacuation"
                onPress={onStartTemporary}
                style={styles.action}
              />
            ) : null}
            <PrimaryButton
              title="Find patient"
              onPress={search}
              loading={searching}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.contentPadding,
    backgroundColor: 'rgba(28,38,48,0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  action: {
    minWidth: 140,
    justifyContent: 'center',
  },
});
