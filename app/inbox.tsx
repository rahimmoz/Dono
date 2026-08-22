import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

type Conversation = {
  partner_id: string;
  partner_username: string;
  partner_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  last_message_from_me: boolean;
  unread_count: number;
};

type UserResult = { id: string; username: string; avatar_url: string | null };

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString();
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        fetchConversations(user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchConversations = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_conversations', { p_user_id: userId });
    if (!error && data) setConversations(data);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    if (!currentUserId) return;
    setRefreshing(true);
    fetchConversations(currentUserId);
  };

  // Debounced user search so you can message anyone, not just people you follow.
  useEffect(() => {
    if (searchQuery.trim().length < 2 || !currentUserId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(8);
      setSearchResults(data || []);
      setIsSearching(false);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUserId]);

  const openChat = (id: string, name: string) => {
    setSearchQuery('');
    router.push({ pathname: '/chat/[id]', params: { id, name } });
  };

  const showingSearch = searchQuery.trim().length >= 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search people to message..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#00FF00" style={{ marginTop: 30 }} />
      ) : showingSearch ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            isSearching ? <ActivityIndicator color="#00FF00" style={{ marginTop: 20 }} /> : <Text style={styles.emptyText}>No users found.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item.id, item.username)}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text></View>
              )}
              <Text style={styles.username}>@{item.username}</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.partner_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF00" />}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Search above to start a conversation!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item.partner_id, item.partner_username)}>
              {item.partner_avatar_url ? (
                <Image source={{ uri: item.partner_avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.partner_username?.[0]?.toUpperCase()}</Text></View>
              )}
              <View style={styles.chatInfo}>
                <Text style={styles.username}>@{item.partner_username}</Text>
                <Text style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                  {item.last_message_from_me ? 'You: ' : ''}{item.last_message}
                </Text>
              </View>
              <View style={styles.metaColumn}>
                <Text style={styles.timeText}>{timeAgo(item.last_message_at)}</Text>
                {item.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn: { color: '#fff', fontSize: 24, width: 40 },
  searchBar: { paddingHorizontal: 15, paddingVertical: 10 },
  searchInput: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 20, fontSize: 15, borderWidth: 1, borderColor: '#333' },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  chatInfo: { marginLeft: 15, flex: 1 },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 15 },
  lastMessage: { color: '#888', fontSize: 14, marginTop: 2 },
  lastMessageUnread: { color: '#fff', fontWeight: '600' },
  metaColumn: { alignItems: 'flex-end' },
  timeText: { color: '#666', fontSize: 12 },
  unreadBadge: { backgroundColor: '#00FF00', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingHorizontal: 5 },
  unreadBadgeText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 30 },
});
