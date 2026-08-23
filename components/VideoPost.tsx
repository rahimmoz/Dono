import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../supabase';
import ReportModal from './ReportModal';


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

type VideoPostProps = { 
  video: VideoItem; 
  onDonate: (
    videoIdOrAmount: string | number,
    receiverId?: string,
    receiverName?: string,
    amount?: number,
  ) => void;
  isActive: boolean; 
  currentUserId: string | null; 
  onOpenComments: (videoId: string) => void; 
  itemHeight: number;
  onBlock: (blockedUserId: string) => void;
};

// ==========================================
// VIDEO POST COMPONENT
// ==========================================
const VideoPost = ({ video, onDonate, isActive, currentUserId, onOpenComments, itemHeight, onBlock }: VideoPostProps) => {

  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes_count || 0); 
  const [isFollowing, setIsFollowing] = useState(false);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  // 1. Add a new ref to keep track of our timer
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Replace handleTap with this smart version
  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300; 

    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      // It's a double tap! 
      // Cancel the pause timer immediately so the video keeps playing.
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      triggerDoubleTapLike();
    } else {
      // It's the first tap. 
      // Start a tiny 300ms timer to see if they tap a second time before pausing.
      tapTimeout.current = setTimeout(() => {
        setIsPaused((prev) => !prev);
      }, DOUBLE_PRESS_DELAY);
    }
    lastTap.current = now;
  };

  // expo-video: the player is an imperative object, not a set of props.
  // We create one per VideoPost and drive play/pause/mute from isActive/isPaused below.
  const player = useVideoPlayer(video.video_url, (p) => {
    p.loop = true;
    p.muted = true; // start muted; unmuted only when this post becomes active
  });

  useEffect(() => {
    if (isActive && !isPaused) {
      player.muted = false;
      player.play();
    } else if (isActive && isPaused) {
      // user tapped to pause; keep audio state as-is, just stop playback
      player.pause();
    } else {
      // off-screen: mute and pause so it doesn't play audio/burn battery in the background
      player.muted = true;
      player.pause();
    }
  }, [isActive, isPaused, player]);

  useEffect(() => {
    Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 3000, useNativeDriver: true })).start();
  }, []);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const bumpInterestScore = async (points: number) => {
    if (!currentUserId || !video.category) return;
    try {
      await supabase.from('user_interests').upsert({
        user_id: currentUserId,
        category: video.category,
        score: points 
      }, { onConflict: 'user_id, category' });
    } catch (error) {
      console.log('Algorithm update failed silently', error);
    }
  };

  useEffect(() => {
    let watchTimer: ReturnType<typeof setTimeout> | undefined;
    if (isActive && currentUserId) {
      watchTimer = setTimeout(() => {
        bumpInterestScore(1);
      }, 3000); 
    }
    return () => {
      if (watchTimer) clearTimeout(watchTimer);
    }; 
  }, [isActive, currentUserId, video.category]);

  const triggerDoubleTapLike = () => {
    if (!isLiked) handleLike();
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.timing(heartOpacity, { toValue: 1, duration: 100, useNativeDriver: true })
      ]),
      Animated.delay(600), 
      Animated.timing(heartOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => heartScale.setValue(0));
  };

  useEffect(() => {
    const checkStatus = async () => {
      if (!currentUserId) return;
      const { data: likeData } = await supabase.from('likes').select('id').eq('video_id', video.id).eq('user_id', currentUserId).single();
      if (likeData) setIsLiked(true);

      if (currentUserId !== video.creator_id) {
        const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', video.creator_id).single();
        if (followData) setIsFollowing(true);
      }
    };
    checkStatus();
  }, [video.id, currentUserId]);
  
  const handleLike = async () => {
    if (!currentUserId) return Alert.alert("Login to like videos!");
    if (isLiked) {
      const { error } = await supabase.from('likes').delete().eq('video_id', video.id).eq('user_id', currentUserId);
      if (!error) { setIsLiked(false); setLikeCount(prev => prev - 1); }
    } else {
      const { error } = await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
      if (!error) { 
        setIsLiked(true); 
        setLikeCount(prev => prev + 1); 
        bumpInterestScore(3); 
      }
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) return Alert.alert("Login to follow creators!");
    if (isFollowing) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', video.creator_id);
      if (!error) setIsFollowing(false);
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: video.creator_id });
      if (!error) setIsFollowing(true);
    }
  };

  const [reportModalVisible, setReportModalVisible] = useState(false);

  const handleOpenOptions = () => {
    Alert.alert(video.creator, undefined, [
      { text: 'Report Video', onPress: () => setReportModalVisible(true) },
      { text: `Block @${video.creator}`, style: 'destructive', onPress: handleBlockCreator },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitVideoReport = async (reason: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_video_id: video.id,
      reported_user_id: video.creator_id,
      reason,
    });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Reported', 'Thanks for letting us know -- our team will review this.');
  };

  const handleBlockCreator = () => {
    Alert.alert(
      `Block @${video.creator}?`,
      "You won't see their content anymore, and neither of you will be able to message each other.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: video.creator_id });
            if (error) Alert.alert('Error', error.message);
            else onBlock(video.creator_id);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.videoContainer, { height: itemHeight }]}>
      {/* LAYER 1: The Video (At the very bottom) */}
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />

      {/* LAYER 2: The Tap Shield (Sitting on top of the video) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
        {isPaused && (
           <View style={styles.pauseOverlay} pointerEvents="none">
             <Text style={styles.playIcon}>▶️</Text>
           </View>
        )}
        <Animated.View style={[styles.floatingHeartContainer, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
          <Text style={styles.giantHeart}>❤️</Text>
        </Animated.View>
      </Pressable>

      {/* LAYER 3: The UI Overlay (The buttons and text on the very top) */}
      <View style={styles.uiOverlay} pointerEvents="box-none">
        <View style={styles.bottomLeft}>
          <View style={styles.creatorRow}>
            <Text style={styles.creatorText}>{video.creator}</Text>
            {currentUserId && currentUserId !== video.creator_id && (
              <TouchableOpacity style={[styles.followBtn, isFollowing ? styles.followingBtn : null]} onPress={handleFollow}>
                <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.descriptionText}>{video.description}</Text>
          <View style={styles.audioRow}>
            <Text style={styles.audioIcon}>🎵</Text>
            <Text style={styles.audioText} numberOfLines={1}>{video.audios?.name || `Original Sound - ${video.creator}`}</Text>
          </View>
        </View>

        <View style={styles.sideBar} pointerEvents="box-none">
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}><Text style={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</Text><Text style={styles.actionText}>{likeCount}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => onOpenComments(video.id)}><Text style={styles.actionIcon}>💬</Text><Text style={styles.actionText}>View</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.donateButton]} onPress={() => onDonate(video.id, video.creator_id, video.creator)}>
            <Text style={styles.actionIcon}>🪙</Text>
            <Text style={styles.actionText}>Donate</Text>
          </TouchableOpacity>
          {currentUserId && currentUserId !== video.creator_id && (
            <TouchableOpacity style={styles.actionButton} onPress={handleOpenOptions}>
              <Text style={[styles.actionIcon, { color: '#fff' }]}>⋯</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.recordContainer, { transform: [{ rotate: spin }] }]}><Text style={styles.recordIcon}>💿</Text></Animated.View>
        </View>
      </View>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetLabel="this video"
        onSubmit={submitVideoReport}
      />

    </View>
  );
};

export default VideoPost;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { width: '100%', justifyContent: 'center' },
  topNav: { position: 'absolute', zIndex: 100, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  navText: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 'bold' },
  navTextActive: { color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  navSeparator: { color: 'rgba(255,255,255,0.4)', marginHorizontal: 15, fontSize: 16 },
  globalWallet: { position: 'absolute', top: 100, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  balanceText: { color: '#00FF00', fontSize: 14, fontWeight: 'bold' },
  emptyFeed: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyFeedText: { color: '#888', textAlign: 'center', fontSize: 16, lineHeight: 24 },
  uiOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', paddingBottom: 20, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'flex-end' },
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
  pauseOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  playIcon: { fontSize: 80, opacity: 0.8 },
  authContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  authTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  authBtn: { backgroundColor: '#00FF00', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  authBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  switchText: { color: '#888', textAlign: 'center', marginTop: 20, fontSize: 14 },
  floatingHeartContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
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
  neonBorder: { ...StyleSheet.absoluteFill, borderWidth: 8, zIndex: 998 },
  animCenterContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
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
