import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { prettyDate, toISODate } from '@/utils/format';

// Tappable field that opens the native date picker. `value` is 'YYYY-MM-DD'.
export default function DateField({ value, onChange, style, disabled }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [open, setOpen] = useState(false);
  const current = value ? new Date(`${value}T12:00:00`) : new Date();

  const handleValue = (_event, selected) => {
    if (selected) onChange(toISODate(selected));
  };
  const handleDismiss = () => setOpen(false);

  return (
    <>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled, style]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}>
        <Text style={[styles.text, disabled && styles.textDisabled]}>
          {value ? prettyDate(value) : 'Pick a date'}
        </Text>
      </Pressable>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={current}
          mode="date"
          onValueChange={handleValue}
          onDismiss={handleDismiss}
        />
      )}
      {open && Platform.OS !== 'android' && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                onValueChange={handleValue}
                onDismiss={handleDismiss}
                style={styles.picker}
              />
              <Pressable style={styles.done} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const makeStyles = (t) => StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    backgroundColor: t.colors.background,
  },
  fieldDisabled: { backgroundColor: t.colors.surface },
  text: { fontSize: 15, color: t.colors.text },
  textDisabled: { color: t.colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    padding: t.spacing(4),
  },
  picker: { alignSelf: 'center' },
  done: {
    marginTop: t.spacing(3),
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(3),
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '700' },
});
