import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Use memo to prevent re-renders unless the message actually changes
export const MessageItem = React.memo(({ item, isMine }: { item: any, isMine: boolean }) => {
  return (
    <View style={[styles.bubble, isMine ? styles.myMsg : styles.theirMsg]}>
      <Text style={[styles.text, { color: isMine ? '#000' : '#fff' }]}>
        {item.content}
      </Text>
      <Text style={[styles.time, { color: isMine ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>
        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  bubble: { padding: 12, borderRadius: 20, marginVertical: 4, marginHorizontal: 15, maxWidth: '80%' },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#00FF00' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#333' },
  text: { fontSize: 15 },
  time: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }
});