import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type DonateModalProps = {
  visible: boolean;
  onClose: () => void;
  onDonate: (amount: number) => Promise<void>;
  walletBalance: number;
  receiverName: string;
};

const AMOUNTS = [1, 5, 10, 50];

export default function DonateModal({ visible, onClose, onDonate, walletBalance, receiverName }: DonateModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectAmount = async (amount: number) => {
    setIsProcessing(true);
    await onDonate(amount);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.closeArea} onPress={onClose} />
        
        <View style={styles.bottomSheet}>
          <Text style={styles.title}>Support {receiverName}</Text>
          <Text style={styles.subtitle}>Send coins to show your appreciation!</Text>

          <View style={styles.balanceBadge}>
            <Text style={styles.balanceText}>Your Balance: {walletBalance} 🪙</Text>
          </View>

          <View style={styles.grid}>
            {AMOUNTS.map((amount) => {
              const canAfford = walletBalance >= amount;
              return (
                <TouchableOpacity 
                  key={amount} 
                  style={[styles.amountCard, !canAfford && styles.amountCardDisabled]}
                  disabled={!canAfford || isProcessing}
                  onPress={() => handleSelectAmount(amount)}
                >
                  <Text style={[styles.amountIcon, !canAfford && { opacity: 0.5 }]}>🪙</Text>
                  <Text style={[styles.amountText, !canAfford && { color: '#555' }]}>{amount}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isProcessing && <ActivityIndicator color="#00FF00" style={{ marginTop: 20 }} />}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  closeArea: { flex: 1 },
  bottomSheet: { backgroundColor: '#111', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 20 },
  balanceBadge: { backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
  balanceText: { color: '#00FF00', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountCard: { width: '47%', backgroundColor: '#222', padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  amountCardDisabled: { backgroundColor: '#111', borderColor: '#222' },
  amountIcon: { fontSize: 32, marginBottom: 5 },
  amountText: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});