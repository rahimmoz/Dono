import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type PayoutRequestModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
  walletBalance: number;
};

export default function PayoutRequestModal({ visible, onClose, onSubmit, walletBalance }: PayoutRequestModalProps) {
  const [amountText, setAmountText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = Math.floor(Number(amountText));
  const isValid = amountText.trim().length > 0 && parsedAmount > 0 && parsedAmount <= walletBalance;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(parsedAmount);
      setAmountText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.closeArea} onPress={onClose} />

        <View style={styles.bottomSheet}>
          <Text style={styles.title}>Request Payout</Text>
          <Text style={styles.subtitle}>
            This submits a payout request for our team to review and pay out manually. Coins are set
            aside now so you can't also spend them -- this doesn't send you money automatically yet.
          </Text>

          <View style={styles.balanceBadge}>
            <Text style={styles.balanceText}>Available: {walletBalance} 🪙</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Amount to withdraw"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            value={amountText}
            onChangeText={setAmountText}
            editable={!isSubmitting}
          />

          {amountText.trim().length > 0 && !isValid && (
            <Text style={styles.errorText}>
              {parsedAmount > walletBalance ? "You don't have that many coins." : 'Enter a valid amount.'}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  closeArea: { flex: 1 },
  bottomSheet: { backgroundColor: '#111', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  balanceBadge: { backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  balanceText: { color: '#00FF00', fontWeight: 'bold' },
  input: { width: '100%', backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#333', marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#ff4444', fontSize: 12, marginBottom: 15 },
  submitBtn: { backgroundColor: '#00FF00', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 25, marginTop: 10, width: '100%', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#222' },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
