import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportModal from '../../components/ReportModal';
import { supabase } from '../../supabase';

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams(); // 'id' is the recipient's UUID
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const markAsRead = async (myId: string) => {
    await supabase.rpc('mark_conversation_read', { p_user_id: myId, p_partner_id: id });
  };

  // 1. Initial Setup: Auth & Fetching
  useEffect(() => {
    let channel: any;

    const setupChat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const myId = session.user.id;
        setCurrentUserId(myId);
        fetchMessages(myId);
        markAsRead(myId);

        const { data: myProfile } = await supabase.from('users').select('username').eq('id', myId).single();
        if (myProfile) setMyUsername(myProfile.username);

        // 2. Real-time Subscription -- both new messages AND read-receipt updates
        channel = supabase
          .channel(`chat:${id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const msg = payload.new;
              
              // Only add if it's between Me and the current person we are viewing
              const isRelevant = 
                (msg.sender_id === id && msg.receiver_id === myId) ||
                (msg.sender_id === myId && msg.receiver_id === id);

              if (isRelevant) {
                setMessages((prev) => {
                  if (prev.find(m => m.id === msg.id)) return prev;
                  return [msg, ...prev];
                });

                // If they just messaged us while we're sitting in this chat,
                // immediately mark it read rather than waiting for a re-open.
                if (msg.sender_id === id && msg.receiver_id === myId) {
                  markAsRead(myId);
                }

                // Auto-scroll to bottom (offset 0 because list is inverted)
                setTimeout(() => {
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }, 100);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages' },
            (payload) => {
              const msg = payload.new;
              setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read_at: msg.read_at } : m)));
            }
          )
          .subscribe();
      }
    };

    setupChat();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);

const fetchMessages = async (userId?: string, isLoadMore = false) => {
  const activeUserId = userId ?? currentUserId;
  if (!activeUserId || loadingMore || (!hasMore && isLoadMore)) return;
  
  setLoadingMore(true);
  const PAGE_SIZE = 20;
  const start = isLoadMore ? messages.length : 0;
  const end = start + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${activeUserId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${activeUserId})`)
    .order('created_at', { ascending: false })
    .range(start, end); 

  if (data) {
    setMessages(prev => isLoadMore ? [...prev, ...data] : data);
    setHasMore(data.length === PAGE_SIZE);
  }
  setLoadingMore(false);
};

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;
    const content = newMessage.trim();
    setNewMessage('');

    // Goes through send_message rather than a raw insert so a block between
    // either of you is actually enforced server-side, not just hidden in the UI.
    const { error } = await supabase.rpc('send_message', {
      p_sender_id: currentUserId,
      p_receiver_id: id,
      p_content: content,
    });

    if (error) {
      console.error("Send Error:", error.message);
      Alert.alert("Couldn't send", error.message.includes('message this user') ? error.message : "Message failed to send. Check your connection.");
      return;
    }

    // Fire the push notification -- best-effort, never blocks sending.
    try {
      await supabase.functions.invoke('send-message-notification', {
        body: { receiverId: id, senderName: myUsername, messageContent: content },
      });
    } catch (err) {
      console.log('Push notification skipped:', err);
    }
  };

  // The most recent message index that I sent, so we only show a
  // read-receipt under the LAST bubble, not every single one.
  const lastMineIndex = messages.findIndex((m) => m.sender_id === currentUserId);

  const [reportModalVisible, setReportModalVisible] = useState(false);

  const handleOpenOptions = () => {
    Alert.alert(`@${name}`, undefined, [
      { text: 'Report User', onPress: () => setReportModalVisible(true) },
      { text: `Block @${name}`, style: 'destructive', onPress: handleBlockUser },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitUserReport = async (reason: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_user_id: id,
      reason,
    });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Reported', 'Thanks for letting us know -- our team will review this.');
  };

  const handleBlockUser = () => {
    Alert.alert(
      `Block @${name}?`,
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
            else router.back();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1, backgroundColor: '#000' }}
      keyboardVerticalOffset={Platform.OS === 'android' ? 90 : 0} 
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{name}</Text>
        <TouchableOpacity onPress={handleOpenOptions} style={styles.optionsBtnWrapper}>
          <Text style={styles.backBtn}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetLabel={`@${name}`}
        onSubmit={submitUserReport}
      />

      {/* Message List */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          onEndReached={() => fetchMessages(undefined, true)} // Load more when user scrolls up
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#00FF00" /> : null}
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === currentUserId;
            return (
              <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, { color: isMine ? '#000' : '#fff' }]}>
                  {item.content}
                </Text>
                <Text style={[styles.timestamp, { color: isMine ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isMine && index === lastMineIndex && (
                  <Text style={styles.readReceipt}>{item.read_at ? 'Read' : 'Delivered'}</Text>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Input Area */}
      <View style={[styles.inputWrapper, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Send a message..."
            placeholderTextColor="#888"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline={false}
          />
          <TouchableOpacity 
            style={styles.sendBtnCircle} 
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Text style={styles.sendIcon}>➔</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222',
    backgroundColor: '#000' 
  },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtnWrapper: { width: 40 },
  optionsBtnWrapper: { width: 40, alignItems: 'flex-end' },
  backBtn: { color: '#fff', fontSize: 24 },
  
  messageBubble: { 
    padding: 12, 
    borderRadius: 20, 
    marginVertical: 4, 
    marginHorizontal: 15, 
    maxWidth: '80%' 
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#00FF00' },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#333' },
  messageText: { fontSize: 15 },
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  readReceipt: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2, color: 'rgba(0,0,0,0.5)' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555' },

  inputWrapper: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    color: '#fff',
    height: 45,
    fontSize: 16,
  },
  sendBtnCircle: {
    width: 35,
    height: 35,
    backgroundColor: '#00FF00',
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendIcon: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
