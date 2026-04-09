import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';

const CATEGORIES = ['Comedy', 'Gaming', 'Education', 'Tech', 'Music', 'Vlog'];

export default function UploadStudioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Comedy');
  const [isUploading, setIsUploading] = useState(false);

  // 1. THE NATIVE TRIMMER MAGIC
  const pickAndTrimVideo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true, // 🚨 THIS TRIGGERS THE OS NATIVE VIDEO TRIMMER!
      videoMaxDuration: 60, // Limit to 60 seconds
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!videoUri) return Alert.alert('Hold up!', 'Please select a video first.');
    if (!description.trim()) return Alert.alert('Missing Info', 'Please add a description.');

    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      // 1. Read the trimmed video file
      const response = await fetch(videoUri);
      const fileData = await response.arrayBuffer();
      const fileName = `${session.user.id}-${Date.now()}.mp4`;

      // 2. Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('videos')
        .upload(fileName, fileData, { contentType: 'video/mp4' });

      if (storageError) throw storageError;

      // 3. Get the public URL
      const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(fileName);
      
      // 4. Save to the videos table (with our new Category system!)
      const { error: dbError } = await supabase.from('videos').insert({
        creator_id: session.user.id,
        video_url: publicUrlData.publicUrl,
        description: description.trim(),
        category: selectedCategory, // 🧠 Feeds the Algorithm!
        likes_count: 0
      });

      if (dbError) throw dbError;

      Alert.alert('Success! 🚀', 'Your video is live on Donate-Tok!');
      setVideoUri(null);
      setDescription('');
      router.push('/'); // Send them back to the feed

    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Creator Studio</Text>
        </View>

        {/* Video Preview / Picker Area */}
        {videoUri ? (
          <View style={styles.previewContainer}>
            <Video style={styles.videoPlayer} source={{ uri: videoUri }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
            <TouchableOpacity style={styles.changeVideoBtn} onPress={pickAndTrimVideo} disabled={isUploading}>
              <Text style={styles.changeVideoText}>Retrim / Change Video</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadPlaceholder} onPress={pickAndTrimVideo}>
            <Text style={styles.uploadIcon}>🎬</Text>
            <Text style={styles.uploadText}>Select & Trim Video</Text>
            <Text style={styles.uploadSubtext}>Max 60 seconds</Text>
          </TouchableOpacity>
        )}

        {/* Details Area */}
        <View style={styles.detailsContainer}>
          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe your video..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            maxLength={100}
            multiline
            editable={!isUploading}
          />

          {/* 🧠 Category Selector for the Algorithm */}
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
                disabled={isUploading}
              >
                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Publish Button */}
          <TouchableOpacity 
            style={[styles.publishBtn, (!videoUri || isUploading) && styles.publishBtnDisabled]} 
            onPress={handleUpload}
            disabled={!videoUri || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.publishBtnText}>Publish to Feed 🚀</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  
  previewContainer: { width: '100%', height: 400, borderRadius: 15, overflow: 'hidden', marginBottom: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  videoPlayer: { flex: 1 },
  changeVideoBtn: { position: 'absolute', bottom: 15, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#fff' },
  changeVideoText: { color: '#fff', fontWeight: 'bold' },
  
  uploadPlaceholder: { width: '100%', height: 400, borderRadius: 15, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#333', borderStyle: 'dashed' },
  uploadIcon: { fontSize: 50, marginBottom: 10 },
  uploadText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  uploadSubtext: { color: '#888', fontSize: 14, marginTop: 5 },
  
  detailsContainer: { flex: 1 },
  label: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  
  categoryScroll: { marginBottom: 30 },
  categoryPill: { backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  categoryPillActive: { backgroundColor: '#00FF00', borderColor: '#00FF00' },
  categoryText: { color: '#fff', fontWeight: 'bold' },
  categoryTextActive: { color: '#000' },
  
  publishBtn: { backgroundColor: '#00FF00', padding: 18, borderRadius: 15, alignItems: 'center' },
  publishBtnDisabled: { backgroundColor: '#222' },
  publishBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' }
});