import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DonateModal from '../../components/DonateModal';
import { supabase } from '../../supabase';

import VideoPost from '../../components/VideoPost';

const { height, width } = Dimensions.get('window');

type VideoItem = { 
  id: string; 
  creator: string; 
  creator_id: string; 
  video_url: string; 
  description: string; 
  likes_count: number; 
  category?: string; 
  audios?: { name: string } | null; 
};

type DonateCallback = (videoIdOrAmount: string | number, receiverId?: string, receiverName?: string, amount?: number) => void;

type VideoPostProps = { 
  video: VideoItem; 
  onDonate: DonateCallback; 
  isActive: boolean; 
  currentUserId: string | null; 
  onOpenComments: (videoId: string) => void; 
};


// ==========================================
// 1. AUTH SCREEN
// ==========================================
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Login Failed', error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { username: username } } });
      if (error) Alert.alert('Signup Failed', error.message);
      else Alert.alert('Success!', 'Account created. Please log in.');
    }
    setLoading(false);
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.authTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
      {!isLogin && <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#888" value={username} onChangeText={setUsername} autoCapitalize="none" />}
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.authBtn} onPress={handleAuth} disabled={loading}><Text style={styles.authBtnText}>{loading ? 'Loading...' : (isLogin ? 'Log In' : 'Sign Up')}</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={styles.switchText}>{isLogin ? "Need an account? Sign Up" : "Have an account? Log In"}</Text></TouchableOpacity>
    </View>
  );
};

// ==========================================
// 2. COMMENT MODAL
// ==========================================
const CommentModal = ({ videoId, currentUserId, onClose }: { videoId: string | null, currentUserId: string | null, onClose: () => void }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (videoId) fetchComments();
  }, [videoId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, users(username, avatar_url)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });
    setComments(data || []);
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUserId || !videoId) return;
    setIsSubmitting(true);
    
    const { data, error } = await supabase
      .from('comments')
      .insert({ video_id: videoId, user_id: currentUserId, content: newComment.trim() })
      .select('*, users(username, avatar_url)')
      .single();

    if (!error && data) {
      setComments([data, ...comments]); 
      setNewComment('');
    }
    setIsSubmitting(false);
  };

  return (
    <Modal visible={!!videoId} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
        <Pressable style={styles.modalCloseArea} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>{comments.length} Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalBtn}>
              <Text style={{color: '#888', fontWeight: 'bold', fontSize: 18}}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList 
            data={comments} 
            keyExtractor={(item) => item.id} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                {item.users?.avatar_url ? (
                  <Image source={{ uri: item.users.avatar_url }} style={styles.commentAvatarImg} />
                ) : (
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{item.users?.username?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.commentContent}>
                  <Text style={styles.commentUser}>@{item.users?.username}</Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
              </View>
            )} 
          />
          <View style={styles.commentInputContainer}>
            <TextInput 
              style={styles.commentInput} 
              placeholder="Add a comment..." 
              placeholderTextColor="#888" 
              value={newComment} 
              onChangeText={setNewComment} 
              cursorColor="#00FF00" 
            />
            <TouchableOpacity onPress={handlePostComment} disabled={isSubmitting || !newComment.trim()}>
              <Text style={[styles.postBtnText, (!newComment.trim() || isSubmitting) && { opacity: 0.5 }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ==========================================
// 🚨 NEW: 3. TIERED DONATION ANIMATION OVERLAY
// ==========================================
const DonationAnimation = ({ donation, onComplete }: { donation: { amount: number, receiver: string } | null, onComplete: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const translateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (donation) {
      const isWhale = donation.amount >= 50;
      
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: isWhale ? 1.4 : 1, friction: 3, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
        ]),
        // Hold the animation longer if they dropped a ton of coins
        Animated.delay(isWhale ? 3500 : 1500),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -50, duration: 300, useNativeDriver: true })
        ])
      ]).start(() => {
        scale.setValue(0.5);
        translateY.setValue(50);
        onComplete();
      });
    }
  }, [donation]);

  if (!donation) return null;

  // Determine styles based on amount
  let theme = { color: '#00FF00', title: 'NICE TIP!', shadow: '#00FF00', glow: 'rgba(0, 255, 0, 0.2)' };
  if (donation.amount >= 5) theme = { color: '#00f2ea', title: 'GREAT DONATION!', shadow: '#00f2ea', glow: 'rgba(0, 242, 234, 0.3)' };
  if (donation.amount >= 10) theme = { color: '#FFD700', title: 'GOLDEN SUPPORT!', shadow: '#FF8C00', glow: 'rgba(255, 215, 0, 0.4)' };
  if (donation.amount >= 50) theme = { color: '#FF00FF', title: '🚨 WHALE DROP 🚨', shadow: '#FF00FF', glow: 'rgba(255, 0, 255, 0.6)' };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* If it's a massive donation, flash a glowing neon border around the whole screen */}
      {donation.amount >= 50 && (
        <Animated.View style={[styles.neonBorder, { opacity, borderColor: theme.color }]} />
      )}
      
      {/* The Central Animation */}
      <View style={styles.animCenterContainer}>
        <Animated.View style={[styles.animBox, { opacity, transform: [{ scale }, { translateY }], shadowColor: theme.shadow }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glow, borderRadius: 20, shadowColor: theme.shadow, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 }]} />
          <Text style={[styles.animTitle, { color: theme.color, textShadowColor: theme.shadow }]}>{theme.title}</Text>
          <Text style={styles.animSub}>You sent <Text style={{fontWeight: 'bold', color: '#fff'}}>{donation.amount} 🪙</Text> to {donation.receiver}!</Text>
        </Animated.View>
      </View>
    </View>
  );
};

// ==========================================
// 5. MAIN APP
// ==========================================
export default function App() {
  const insets = useSafeAreaInsets(); 
  
  const [session, setSession] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [isDonating, setIsDonating] = useState(false);

  const PAGE_SIZE = 5; // How many videos to load per swipe

  const [page, setPage] = useState(0); // Tracks current page
  const [hasMore, setHasMore] = useState(true); // Tells us if the database is empty
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Prevents duplicate fetches

  const [donateData, setDonateData] = useState<{videoId: string, receiverId: string, receiverName: string} | null>(null);
  
  // 🚨 NEW: State to trigger the massive floating animation
  const [activeDonationAnim, setActiveDonationAnim] = useState<{amount: number, receiver: string} | null>(null);

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 50 },
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: any[] }) => {
        if (viewableItems.length > 0) setActiveVideoId(viewableItems[0].item.id);
      },
    },
  ]);

// 1. Add pageNumber to your function parameters (defaults to 0)
const fetchData = async (userId: string, selectedFeed: 'foryou' | 'following' = feedType, pageNumber = 0) => {
  // 2. Prevent fetching if we are already loading infinite scroll or have no more videos
  if (pageNumber > 0 && (isLoadingMore || !hasMore)) return;

  if (pageNumber === 0) {
    setIsLoading(true); // First load
  } else {
    setIsLoadingMore(true); // Scrolling load
  }

  try {
    // 3. Keep your Wallet fetch (We only need to fetch this on the first load, page 0)
    if (pageNumber === 0) {
      const { data: walletData } = await supabase.from('users').select('wallet_balance').eq('id', userId).single();
      setWalletBalance(walletData?.wallet_balance ?? 0);
    }

    // 4. Keep your awesome relational query
    let baseQuery = supabase
      .from('videos')
      .select('id, creator_id, video_url, description, likes_count, category, users(username), audios(name)')
      .order('created_at', { ascending: false });
    
    // --- ADD THIS NEW FOLLOWING FEED LOGIC ---
    if (selectedFeed === 'following') {
      // A. Fetch the IDs of the creators the current user follows
      const { data: followData, error: followError } = await supabase
        .from('follows') // Make sure this matches your actual table name!
        .select('following_id') 
        .eq('follower_id', userId);
      
    if (followError) {
        console.error("Error fetching followers:", followError);
        // If there's an error, we might want to gracefully fail
        setIsLoading(false);
        setIsLoadingMore(false);
        return; 
      }

    // B. Extract the IDs into a simple array: ['user1', 'user2', ...]
      const followingIds = followData ? followData.map(f => f.following_id) : [];

      // C. If they don't follow anyone, immediately stop and show an empty feed
      if (followingIds.length === 0) {
        if (pageNumber === 0) setVideos([]);
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return; 
      }

      // D. Filter the main query to ONLY include videos from these creators
      baseQuery = baseQuery.in('creator_id', followingIds);
    }
    // -----------------------------------------
  

    // 5. THE MAGIC: Calculate range and append it to your baseQuery
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    baseQuery = baseQuery.range(from, to);

    // 6. Execute the query
    const { data: rawVideosData, error } = await baseQuery;

    if (error) {
      console.error("Error fetching videos:", error);
    } else if (rawVideosData) {
      
      // 7. Check if we hit the end of the database
      if (rawVideosData.length < PAGE_SIZE) {
        setHasMore(false);
      }

      // 8. Update the state (Replace if page 0, append if scrolling)
      if (rawVideosData && Array.isArray(rawVideosData)) {
        // Normalize Supabase relational response to our VideoItem type
        const mapped = rawVideosData.map((v: any) => ({
          id: v.id,
          creator: v.users?.[0]?.username ?? '',
          creator_id: v.creator_id,
          video_url: v.video_url,
          description: v.description,
          likes_count: v.likes_count ?? 0,
          category: v.category,
          audios: Array.isArray(v.audios) ? (v.audios[0] ?? null) : (v.audios ?? null),
        } as VideoItem));

        if (pageNumber === 0) {
          setVideos(mapped);
        } else {
          setVideos(prev => [...prev, ...mapped]);
        }
      }
      
      setPage(pageNumber);
    }

  } catch (error) {
    console.error("Fetch Error:", error);
  } finally {
    setIsLoading(false);
    setIsLoadingMore(false);
    setRefreshing(false);
  }
};

  const onRefresh = async () => {
    if (!session?.user?.id) return;
    setRefreshing(true); await fetchData(session.user.id, feedType);
  };

  const handleFeedSwitch = async (type: 'foryou' | 'following') => {
    setFeedType(type);
    if (!session?.user?.id) return;
    setRefreshing(true); await fetchData(session.user.id, type);
  };

  const handleOpenDonate: DonateCallback = (videoIdOrAmount, receiverId, receiverName) => {
    if (typeof videoIdOrAmount === 'number') return;
    if (!receiverId || !receiverName) return;
    if (!session?.user?.id) return Alert.alert('Login required', 'Please log in to donate.');
    if (session.user.id === receiverId) return Alert.alert('Not allowed', "You can't donate to yourself.");
    setDonateData({ videoId: videoIdOrAmount, receiverId, receiverName });
  };

  const processDonation = async (amount: number) => {
    if (!session?.user?.id || !donateData || isDonating) return;

    if (walletBalance < amount) { 
      Alert.alert('Insufficient balance', 'You do not have enough coins.'); 
      return; 
    }

    setIsDonating(true);

    try {
      // 1. Secure Database Transaction
      const { error } = await supabase.rpc('donate_coins', {
        sender_id: session.user.id,
        receiver_id: donateData.receiverId,
        donation_amount: amount,
        target_video_id: donateData.videoId 
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // 2. Update local wallet instantly
      setWalletBalance((prev) => prev - amount);
      
      // 3. Trigger your awesome tiered animation!
      setActiveDonationAnim({ amount, receiver: donateData.receiverName });
      
      // 4. Close the modal
      setDonateData(null);

      // 5. Fire your Push Notification (Keep your existing logic!)
      // (Optional: You can paste your fetch('https://exp.host...') push logic right here)

    } catch (err) {
      console.error("Donation processing error:", err);
    } finally {
      setIsDonating(false);
    }
  };

  const { startId } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (startId && videos.length > 0) {
      const index = videos.findIndex(v => v.id === startId);
      if (index !== -1) setTimeout(() => { flatListRef.current?.scrollToIndex({ index, animated: false }); }, 100);
    }
  }, [startId, videos]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData(session.user.id, feedType);
      else setIsLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id, feedType);
      else { setVideos([]); setWalletBalance(0); setIsLoading(false); }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  if (isLoading && videos.length === 0) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#00FF00" /></View>;
  if (!session) return <AuthScreen />;

return (
  <View style={styles.container}>
    {/* 🚨 Updated Top Nav with Search and Inbox */}
    <View style={[styles.topNav, { top: insets.top + 10 }]}>
      {/* Left Side: Empty or Logo */}
      <View style={{ flex: 1 }} />

      {/* Center: Feed Switcher */}
      <View style={styles.feedSwitcher}>
        <TouchableOpacity onPress={() => handleFeedSwitch('following')}>
          <Text style={[styles.navText, feedType === 'following' && styles.navTextActive]}>Following</Text>
        </TouchableOpacity>
        <Text style={styles.navSeparator}>|</Text>
        <TouchableOpacity onPress={() => handleFeedSwitch('foryou')}>
          <Text style={[styles.navText, feedType === 'foryou' && styles.navTextActive]}>For You</Text>
        </TouchableOpacity>
      </View>

      {/* 🚨 Right Side: Search & Inbox */}
      <View style={styles.topRightActions}>
        <TouchableOpacity onPress={() => router.push('/explore')}>
          <Text style={styles.topIcon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('./inbox')}>
          <Text style={[styles.topIcon, { marginLeft: 15 }]}>✉️</Text>
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.globalWallet}><Text style={styles.balanceText}>{walletBalance} 🪙</Text></View>

      {videos.length === 0 ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyFeedText}>
            {feedType === 'following' ? "You aren't following anyone yet! Go to the 'For You' feed to find creators." : "No videos available."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          renderItem={({ item }) => (
            <VideoPost 
              video={item} 
              isActive={activeVideoId === item.id} 
              currentUserId={session?.user?.id} 
              onOpenComments={setCommentVideoId}
              onDonate={handleOpenDonate}
            />
          )}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          ref={flatListRef}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReached={() => fetchData(session?.user?.id, feedType, page + 1)} 
          onEndReachedThreshold={0.5} 
          ListFooterComponent={isLoadingMore ? <ActivityIndicator size="large" color="#fff" style={{ margin: 20 }} /> : null}
        />
      )}

      <CommentModal videoId={commentVideoId} currentUserId={session?.user?.id} onClose={() => setCommentVideoId(null)} />
      
      <DonateModal 
        visible={!!donateData}
        walletBalance={walletBalance}
        receiverName={donateData?.receiverName || ''}
        onClose={() => setDonateData(null)}
        onDonate={processDonation}
      />

      {/* 🚨 NEW: Render the massive floating animation on top of everything! */}
      <DonationAnimation 
        donation={activeDonationAnim} 
        onComplete={() => setActiveDonationAnim(null)} 
      />

      <StatusBar style="light" />
    </View>
  );
}

// ==========================================
// 6. STYLES
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { height: height, width: '100%', justifyContent: 'center' },
  topNav: { position: 'absolute', zIndex: 100, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  navText: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 'bold' },
  navTextActive: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  navSeparator: { color: 'rgba(255,255,255,0.4)', marginHorizontal: 15, fontSize: 16 },
  globalWallet: { position: 'absolute', top: 100, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  balanceText: { color: '#00FF00', fontSize: 14, fontWeight: 'bold' },
  emptyFeed: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyFeedText: { color: '#888', textAlign: 'center', fontSize: 16, lineHeight: 24 },
  uiOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', paddingBottom: Platform.OS === 'android' ? 120 : 100, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'flex-end' },
  bottomLeft: { flex: 1, paddingRight: 20 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  creatorText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  followBtn: { marginLeft: 10, backgroundColor: '#00FF00', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fff' },
  followBtnText: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  descriptionText: { color: '#fff', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  sideBar: { alignItems: 'center', justifyContent: 'flex-end' },
  actionButton: { alignItems: 'center', marginBottom: 20 },
  actionIcon: { fontSize: 32, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  actionText: { color: '#fff', fontWeight: '600', marginTop: 4, fontSize: 13 },
  donateButton: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  pauseOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  playIcon: { fontSize: 80, opacity: 0.8 },
  authContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  authTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  authBtn: { backgroundColor: '#00FF00', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  switchText: { color: '#888', textAlign: 'center', marginTop: 20, fontSize: 14 },
  floatingHeartContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  giantHeart: { fontSize: 120, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 20 },
  audioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  audioIcon: { fontSize: 14, marginRight: 5 },
  audioText: { color: '#fff', fontSize: 14, width: '80%', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  recordContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginTop: 10, borderWidth: 8, borderColor: '#111' },
  recordIcon: { fontSize: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCloseArea: { flex: 1 },
  bottomSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '65%', paddingBottom: 20 },
  commentHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  commentTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  closeModalBtn: { position: 'absolute', right: 15 },
  commentItem: { flexDirection: 'row', marginBottom: 15, paddingHorizontal: 15 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  commentAvatarImg: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  commentAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  commentContent: { flex: 1 },
  commentUser: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  commentText: { color: 'white', fontSize: 14 },
  commentInputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#222', alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 },
  postBtnText: { color: '#00FF00', fontWeight: 'bold', fontSize: 16 },

  // 🚨 NEW: ANIMATION STYLES
  neonBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 8, zIndex: 998 },
  animCenterContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  animBox: { padding: 30, alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 30 },
  animTitle: { fontSize: 36, fontWeight: '900', fontStyle: 'italic', marginBottom: 10, textShadowRadius: 15, textShadowOffset: { width: 0, height: 0 } },
  animSub: { color: '#ccc', fontSize: 18, fontWeight: '600' },

  topRightActions: { 
  flex: 1, 
  flexDirection: 'row', 
  justifyContent: 'flex-end', 
  paddingRight: 20 
},
topIcon: { 
  fontSize: 22, 
  color: '#fff', 
  textShadowColor: 'rgba(0,0,0,0.8)', 
  textShadowRadius: 10 
},
feedSwitcher: { 
  flexDirection: 'row', 
  alignItems: 'center' 
},
});