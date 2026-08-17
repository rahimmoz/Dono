import { useRouter } from 'expo-router'; // 🚨 NEW IMPORT
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PayoutRequestModal from '../../components/PayoutRequestModal';
import { supabase } from '../../supabase';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter(); // 🚨 INITIALIZE ROUTER
  
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [myVideos, setMyVideos] = useState<any[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfileData(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfileData(session.user.id);
      } else {
        // Clear data and send them home if they are logged out
        setProfile(null);
        setMyVideos([]);
        setLoading(false);
        router.replace('/'); // 🚨 AUTOMATIC REDIRECT TO LOGIN
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        Alert.alert('Error', 'Could not log out.');
    } else {
        // The onAuthStateChange listener above will handle the router.replace('/')
        // but we can add it here too for double safety.
        router.replace('/'); 
    }
  };

  const fetchProfileData = async (userId: string) => {
    setLoading(true);
    // 🚨 Change 'profiles' to 'users' right here!
    const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single();
    setProfile(userData);
    setWalletBalance(userData?.wallet_balance || 0);

    const { data: videoData } = await supabase.from('videos').select('*').eq('creator_id', userId).order('created_at', { ascending: false });
    if (videoData) {
      setMyVideos(videoData);
      setTotalLikes(videoData.reduce((sum, item) => sum + (item.likes_count || 0), 0));
    }

    const { count: fers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    const { count: fing } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId);
    setFollowersCount(fers || 0);
    setFollowingCount(fing || 0);
    
    setLoading(false);
  };

  const [payoutModalVisible, setPayoutModalVisible] = useState(false);

  const handleOpenPayoutModal = () => {
    if (walletBalance <= 0) return Alert.alert("Whoops!", "You don't have any coins to withdraw yet!");
    setPayoutModalVisible(true);
  };

  const handleRequestPayout = async (amount: number) => {
    const { error } = await supabase.rpc('request_payout', {
      requesting_user_id: session.user.id,
      requested_amount: amount,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setWalletBalance((prev) => prev - amount);
    setPayoutModalVisible(false);
    Alert.alert(
      'Request submitted 🎉',
      `Your request for ${amount} coins is pending review. We'll reach out once it's processed.`
    );
  };

  const confirmDelete = (videoId: string, videoUrl: string) => {
    Alert.alert("Delete Video?", "Permanently remove video?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(videoId, videoUrl) }
    ]);
  };

  const handleDelete = async (videoId: string, videoUrl: string) => {
    try {
      await supabase.from('videos').delete().eq('id', videoId);
      const fileName = videoUrl.split('/').pop();
      if (fileName) await supabase.storage.from('videos').remove([fileName]);
      setMyVideos(prev => {
        const updated = prev.filter(v => v.id !== videoId);
        setTotalLikes(updated.reduce((sum, item) => sum + (item.likes_count || 0), 0));
        return updated;
      });
    } catch (e) { console.error(e); }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator color="#00FF00" /></View>;
  
  // If no session, this will only show briefly before the router.replace kicks in
  if (!session) return <View style={[styles.container, styles.centered]}><ActivityIndicator color="#00FF00" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarPlaceholder} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{profile?.username?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.bio ? (
          <Text style={styles.bioText}>{profile.bio}</Text>
        ) : null}
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={styles.statNumber}>{myVideos.length}</Text><Text style={styles.statLabel}>Videos</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{followersCount}</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statNumber}>{totalLikes}</Text><Text style={styles.statLabel}>Likes</Text></View>
        </View>

        <View style={styles.walletBadge}><Text style={styles.walletText}>Balance: {walletBalance} 🪙</Text></View>

        <TouchableOpacity 
          style={styles.leaderboardLink} 
          onPress={() => router.push('/leaderboard')}
        >
          <Text style={styles.leaderboardLinkText}>🏆 View Global Leaderboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.withdrawBtn} onPress={handleOpenPayoutModal}><Text style={styles.withdrawBtnText}>Withdraw Funds</Text></TouchableOpacity>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
  
      </View>

      <FlatList
        data={myVideos} numColumns={3} keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.videoThumbnail} onLongPress={() => confirmDelete(item.id, item.video_url)}>
            
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                 <Text style={{color: '#444', fontSize: 24}}>🎬</Text>
              </View>
            )}

            {/* 🚨 NEW: The Stats Badge (Using likes_count for now) */}
            <View style={styles.statsBadge}>
              <Text style={styles.statsText}>▶️ {item.likes_count || 0}</Text>
            </View>

            <View style={styles.deleteHint}><Text style={{color: 'white', fontSize: 10}}>Hold to Delete</Text></View>
          </TouchableOpacity>
        )}
      />

      <PayoutRequestModal
        visible={payoutModalVisible}
        walletBalance={walletBalance}
        onClose={() => setPayoutModalVisible(false)}
        onSubmit={handleRequestPayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00FF00', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#000' },
  username: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, width: '90%' },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12 },
  statDivider: { width: 1, height: 25, backgroundColor: '#333' },
  walletBadge: { backgroundColor: '#111', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  walletText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  withdrawBtn: { backgroundColor: '#00FF00', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 25 },
  withdrawBtnText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
  logoutBtn: { marginTop: 15, padding: 10 },
  logoutText: { color: '#ff4444', fontSize: 14, fontWeight: 'bold' },
  videoThumbnail: { width: COLUMN_WIDTH, height: COLUMN_WIDTH * 1.4, padding: 1, backgroundColor: '#111' },
  deleteHint: { position: 'absolute', bottom: 5, width: '100%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  emptyText: { color: '#555' },
  bioText: { color: '#ccc', fontSize: 14, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 },
  editBtn: { backgroundColor: '#222', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 25, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  statsBadge: { position: 'absolute', bottom: 25, left: 5, flexDirection: 'row', alignItems: 'center' },
  statsText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5 },
  leaderboardLink: { 
  marginBottom: 15 
},
leaderboardLinkText: { 
  color: '#FFD700', 
  fontWeight: 'bold', 
  fontSize: 14 
},
});