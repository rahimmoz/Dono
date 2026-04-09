import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // We keep a list of IDs we are following so we can show the right button state
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // 1. Get the current user and who they follow on load
  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        fetchFollowing(session.user.id);
      }
    };
    setup();
  }, []);

  const fetchFollowing = async (userId: string) => {
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
    if (data) {
      setFollowingIds(data.map(f => f.following_id));
    }
  };

  // 2. The Search Function
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    // Use .ilike() for case-insensitive "fuzzy" searching
    const { data, error } = await supabase
      .from('users')
      .select('id, username, bio')
      .ilike('username', `%${text}%`)
      .neq('id', currentUserId) // Don't show ourselves in the results!
      .limit(20);

    if (data) setResults(data);
    setIsSearching(false);
  };

  // 3. Inline Follow/Unfollow Logic
  const toggleFollow = async (targetUserId: string) => {
    if (!currentUserId) return;

    const isFollowing = followingIds.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', targetUserId);
      if (!error) {
        setFollowingIds(prev => prev.filter(id => id !== targetUserId));
      }
    } else {
      // Follow
      const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId });
      if (!error) {
        setFollowingIds(prev => [...prev, targetUserId]);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search creators..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isSearching ? (
        <View style={styles.center}><ActivityIndicator color="#00FF00" /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            searchQuery.length >= 2 ? (
              <Text style={styles.emptyText}>No creators found matching "{searchQuery}"</Text>
            ) : (
              <Text style={styles.emptyText}>Type a username to start searching.</Text>
            )
          }
          renderItem={({ item }) => {
            const isFollowing = followingIds.includes(item.id);
            return (
              <View style={styles.userCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                
                <View style={styles.userInfo}>
                  <Text style={styles.username}>@{item.username}</Text>
                  {item.bio ? <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text> : null}
                </View>

                <TouchableOpacity 
                  style={[styles.followBtn, isFollowing && styles.followingBtn]} 
                  onPress={() => toggleFollow(item.id)}
                >
                  <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 15, height: 45, borderWidth: 1, borderColor: '#333' },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  listContainer: { padding: 20 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 16 },
  
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#00FF00', fontSize: 20, fontWeight: 'bold' },
  userInfo: { flex: 1, marginRight: 10 },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  bio: { color: '#888', fontSize: 13 },
  
  followBtn: { backgroundColor: '#00FF00', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  followBtnText: { color: '#000', fontSize: 13, fontWeight: 'bold' },
  followingBtnText: { color: '#fff' }
});