import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
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
import { supabase } from '../../supabase';

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams(); // 'id' is the recipient's UUID
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // 1. Initial Setup: Auth & Fetching
  useEffect(() => {
    let channel: any;

    const setupChat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const myId = session.user.id;
        setCurrentUserId(myId);
        fetchMessages(myId);

        // 2. Real-time Subscription
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

                // Auto-scroll to bottom (offset 0 because list is inverted)
                setTimeout(() => {
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }, 100);
              }
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

  const fetchMessages = async (myId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error.message);
    } else {
      setMessages(data || []);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    const { error } = await supabase.from('messages').insert({
      content: newMessage.trim(),
      sender_id: currentUserId,
      receiver_id: id
    });

    if (error) {
      console.error("Send Error:", error.message);
      Alert.alert("Error", "Message failed to send. Check your connection.");
    } else {
      setNewMessage('');
    }
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
        <View style={{ width: 40 }} />
      </View>

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
          renderItem={({ item }) => {
            const isMine = item.sender_id === currentUserId;
            return (
              <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, { color: isMine ? '#000' : '#fff' }]}>
                  {item.content}
                </Text>
                <Text style={[styles.timestamp, { color: isMine ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
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