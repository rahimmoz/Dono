import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { supabase } from '../supabase';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch unique users you've messaged (Simple version: fetching followed users)
    const { data } = await supabase
      .from('follows')
      .select('following_id, users:following_id(username, avatar_url)')
      .eq('follower_id', user.id);

    setConversations(data || []);
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.following_id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.chatItem}
            onPress={() =>
              router.push({
                pathname: '/chat/[id]',
                params: { id: item.following_id, name: item.users.username },
              })
            }
          >
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{item.users.username[0].toUpperCase()}</Text>
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.username}>@{item.users.username}</Text>
              <Text style={styles.lastMessage}>Say hello!</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn: { color: '#fff', fontSize: 24, width: 40 },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  chatInfo: { marginLeft: 15 },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  lastMessage: { color: '#888', fontSize: 14, marginTop: 2 }
});