import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  targetLabel: string; // e.g. "this video" or "@username"
};

const REASONS = ['Spam', 'Harassment or bullying', 'Inappropriate content', 'Scam or fraud', 'Other'];

export default function ReportModal({ visible, onClose, onSubmit, targetLabel }: ReportModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (reason: string) => {
    setIsSubmitting(true);
    try {
      await onSubmit(reason);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeArea} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Report {targetLabel}</Text>
          <Text style={styles.subtitle}>Why are you reporting this?</Text>

          {isSubmitting ? (
            <ActivityIndicator color="#00FF00" style={{ marginVertical: 30 }} />
          ) : (
            REASONS.map((reason) => (
              <TouchableOpacity key={reason} style={styles.reasonRow} onPress={() => handleSelect(reason)}>
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  closeArea: { flex: 1 },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 15 },
  reasonRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  reasonText: { color: '#fff', fontSize: 15 },
  cancelBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 5 },
  cancelText: { color: '#888', fontSize: 15, fontWeight: '600' },
});
