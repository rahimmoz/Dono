import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

type Creator = {
  id: string;
  username: string;
  avatar_url: string | null;
  wallet_balance: number;
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    // Fetch the top 50 users based on their wallet balance
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, wallet_balance')
      .order('wallet_balance', { ascending: false })
      .limit(50);

    if (data) {
      setCreators(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const renderBadge = (index: number) => {
    if (index === 0) return <Text style={styles.medal}>🥇</Text>;
    if (index === 1) return <Text style={styles.medal}>🥈</Text>;
    if (index === 2) return <Text style={styles.medal}>🥉</Text>;
    return <Text style={styles.rankNumber}>#{index + 1}</Text>;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Top Creators</Text>
        <Text style={styles.headerSubtitle}>The most supported users on Donate-Tok</Text>
      </View>

      <FlatList
        data={creators}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item, index }) => {
          const isTopThree = index < 3;
          return (
            <View style={[styles.row, isTopThree && styles.topThreeRow]}>
              <View style={styles.rankContainer}>
                {renderBadge(index)}
              </View>

              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={[styles.avatar, isTopThree && styles.topThreeAvatar]} />
              ) : (
                <View style={[styles.avatarPlaceholder, isTopThree && styles.topThreeAvatar]}>
                  <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}

              <View style={styles.infoContainer}>
                <Text style={[styles.username, isTopThree && styles.topThreeText]}>@{item.username}</Text>
                <Text style={styles.walletText}>Net Worth</Text>
              </View>

              <View style={styles.scoreContainer}>
                <Text style={[styles.score, isTopThree && styles.topThreeScore]}>{item.wallet_balance}</Text>
                <Text style={styles.coin}>🪙</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#111' },
  headerTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  headerSubtitle: { color: '#888', fontSize: 14, marginTop: 5 },
  listContainer: { padding: 15 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  topThreeRow: { backgroundColor: '#1a1a1a', borderColor: '#333', transform: [{ scale: 1.02 }] },
  rankContainer: { width: 40, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  medal: { fontSize: 28 },
  rankNumber: { color: '#666', fontSize: 18, fontWeight: 'bold' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  topThreeAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFD700' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  infoContainer: { flex: 1, justifyContent: 'center' },
  username: { color: '#ccc', fontSize: 16, fontWeight: 'bold' },
  topThreeText: { color: '#fff', fontSize: 18 },
  walletText: { color: '#666', fontSize: 12, marginTop: 2 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  score: { color: '#fff', fontSize: 18, fontWeight: '900', marginRight: 5 },
  topThreeScore: { color: '#FFD700', fontSize: 22 },
  coin: { fontSize: 16 }
});