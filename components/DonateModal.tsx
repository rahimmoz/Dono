import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GIFT_TIERS } from '../constants/gifts';

type DonateModalProps = {
  visible: boolean;
  onClose: () => void;
  onDonate: (amount: number) => Promise<void>;
  walletBalance: number;
  receiverName: string;
};

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
          <Text style={styles.subtitle}>Send a gift to show your appreciation!</Text>

          <View style={styles.balanceBadge}>
            <Text style={styles.balanceText}>Your Balance: {walletBalance} 🪙</Text>
          </View>

          <ScrollView style={{ width: '100%', maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {GIFT_TIERS.map((tier) => {
                const canAfford = walletBalance >= tier.amount;
                return (
                  <TouchableOpacity 
                    key={tier.amount} 
                    style={[
                      styles.amountCard,
                      !canAfford && styles.amountCardDisabled,
                      canAfford && { borderColor: tier.color },
                    ]}
                    disabled={!canAfford || isProcessing}
                    onPress={() => handleSelectAmount(tier.amount)}
                  >
                    <Text style={[styles.amountIcon, !canAfford && { opacity: 0.4 }]}>{tier.icon}</Text>
                    <Text style={[styles.tierName, canAfford && { color: tier.color }, !canAfford && { color: '#555' }]}>
                      {tier.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.amountText, !canAfford && { color: '#555' }]}>{tier.amount}</Text>
                      <Text style={[styles.priceCoin, !canAfford && { opacity: 0.4 }]}>🪙</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

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
  balanceBadge: { backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  balanceText: { color: '#00FF00', fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  amountCard: { width: '47%', backgroundColor: '#222', paddingVertical: 16, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  amountCardDisabled: { backgroundColor: '#111', borderColor: '#222' },
  amountIcon: { fontSize: 30, marginBottom: 4 },
  tierName: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  priceCoin: { fontSize: 14 },
});
