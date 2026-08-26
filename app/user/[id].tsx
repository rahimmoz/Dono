import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportModal from '../../components/ReportModal';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Viewing your own id -- send them to the real Profile tab (has
      // edit/withdraw/logout, which this screen deliberately doesn't).
      if (id === session.user.id) {
        router.replace('/(tabs)/profile');
        return;
      }

      setCurrentUserId(session.user.id);
      fetchProfile(session.user.id);
    };
    setup();
  }, [id]);

  const fetchProfile = async (myId: string) => {
    setLoading(true);

    // Deliberately NOT selecting wallet_balance -- that's private financial
    // info and has no reason to be visible on someone else's public profile.
    const { data: userData } = await supabase.from('users').select('id, username, bio, avatar_url').eq('id', id).single();
    setProfile(userData);

    const { data: videoData } = await supabase.from('videos').select('*').eq('creator_id', id).order('created_at', { ascending: false });
    if (videoData) {
      setVideos(videoData);
      setTotalLikes(videoData.reduce((sum, item) => sum + (item.likes_count || 0), 0));
    }

    const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id);
    const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id);
    setFollowersCount(fers || 0);
    setFollowingCount(fing || 0);

    const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', myId).eq('following_id', id).maybeSingle();
    setIsFollowing(!!followData);

    const { data: blockData } = await supabase
      .from('blocks')
      .select('id')
      .or(`and(blocker_id.eq.${myId},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${myId})`)
      .maybeSingle();
    setIsBlocked(!!blockData);

    setLoading(false);
  };

  const handleFollow = async () => {
    if (!currentUserId) return;
    if (isFollowing) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id);
      if (!error) { setIsFollowing(false); setFollowersCount((c) => c - 1); }
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id });
      if (!error) { setIsFollowing(true); setFollowersCount((c) => c + 1); }
    }
  };

  const handleOpenOptions = () => {
    Alert.alert(`@${profile?.username}`, undefined, [
      { text: 'Report User', onPress: () => setReportModalVisible(true) },
      { text: isBlocked ? `Unblock @${profile?.username}` : `Block @${profile?.username}`, style: 'destructive', onPress: isBlocked ? handleUnblock : handleBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitReport = async (reason: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_user_id: id, reason });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Reported', 'Thanks for letting us know -- our team will review this.');
  };

  const handleBlock = () => {
    Alert.alert(
      `Block @${profile?.username}?`,
      "You won't see their content anymore, and neither of you will be able to message each other.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: id });
            if (error) Alert.alert('Error', error.message);
            else setIsBlocked(true);
          },
        },
      ]
    );
  };

  const handleUnblock = async () => {
    if (!currentUserId) return;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', id);
    if (!error) setIsBlocked(false);
  };

  const handleMessage = () => {
    if (isBlocked) return Alert.alert('Blocked', "You can't message this user.");
    router.push({ pathname: '/chat/[id]', params: { id: id as string, name: profile?.username } });
  };

  if (loading) return <View style={[styles.container, styles.centered]}><ActivityIndicator color="#00FF00" /></View>;
  if (!profile) return <View style={[styles.container, styles.centered]}><Text style={styles.emptyText}>User not found.</Text></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
        <TouchableOpacity onPress={handleOpenOptions}><Text style={styles.backBtn}>⋯</Text></TouchableOpacity>
      </View>

      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarPlaceholder} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{profile.username?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNumber}>{videos.length}</Text><Text style={styles.statLabel}>Videos</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{followersCount}</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{followingCount}</Text><Text style={styles.statLabel}>Following</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{totalLikes}</Text><Text style={styles.statLabel}>Likes</Text></View>
        </View>

        {isBlocked ? (
          <Text style={styles.blockedNotice}>You've blocked this user.</Text>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.followBtn, isFollowing && styles.followingBtn]} onPress={handleFollow}>
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage}>
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={videos}
        numColumns={3}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No videos yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.videoThumbnail} onPress={() => router.push({ pathname: '/', params: { startId: item.id } })}>
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#444', fontSize: 24 }}>🎬</Text>
              </View>
            )}
            <View style={styles.statsBadge}>
              <Text style={styles.statsText}>▶️ {item.likes_count || 0}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetLabel={`@${profile.username}`}
        onSubmit={submitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { color: '#fff', fontSize: 22 },
  header: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00FF00', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  username: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  bioText: { color: '#ccc', fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 15 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, width: '90%' },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 11 },
  statDivider: { width: 1, height: 25, backgroundColor: '#333' },
  actionRow: { flexDirection: 'row', gap: 10 },
  followBtn: { backgroundColor: '#00FF00', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 20 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  followBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  followingBtnText: { color: '#fff' },
  messageBtn: { backgroundColor: '#222', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  messageBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  blockedNotice: { color: '#ff4444', fontSize: 13, fontWeight: '600' },
  videoThumbnail: { width: COLUMN_WIDTH, height: COLUMN_WIDTH * 1.4, padding: 1, backgroundColor: '#111' },
  statsBadge: { position: 'absolute', bottom: 8, left: 5, flexDirection: 'row', alignItems: 'center' },
  statsText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 20 },
});
