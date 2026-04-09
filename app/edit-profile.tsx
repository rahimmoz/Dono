import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

// 🚨 NEW IMPORTS FOR IMAGE UPLOAD
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Current Avatar
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null); // Newly selected Image
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/');
        return;
      }
      setSession(session);

      const { data, error } = await supabase
        .from('users')
        .select('username, bio, avatar_url') // 🚨 Added avatar_url
        .eq('id', session.user.id)
        .single();

      if (data) {
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || null);
      }
      setIsLoading(false);
    };

    fetchProfile();
  }, []);

  // 🚨 NEW: Function to pick an image from the phone
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow media access to select a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Forces a square crop!
      quality: 0.5, // Compress it slightly so it uploads fast
    });

    if (!result.canceled && result.assets.length > 0) {
      setNewAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) return Alert.alert("Hold up!", "Username cannot be empty.");
    setIsSaving(true);
    
    let finalAvatarUrl = avatarUrl;

    // 🚨 NEW: If they selected a new image, upload it to Storage first
    if (newAvatarUri) {
      try {
        const base64File = await FileSystem.readAsStringAsync(newAvatarUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileName = `${session.user.id}-${Date.now()}.jpg`;

        const { error: storageError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(base64File), { contentType: 'image/jpeg' });

        if (storageError) throw storageError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrlData.publicUrl;
      } catch (err: any) {
        Alert.alert("Image Upload Failed", err.message);
        setIsSaving(false);
        return; // Stop saving if the image fails
      }
    }

    // Update the database with the new text AND the image link
    const { error } = await supabase
      .from('users')
      .update({ 
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: finalAvatarUrl // 🚨 Save the image link to the user
      })
      .eq('id', session.user.id);

    setIsSaving(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success!", "Your profile has been updated.");
      router.back(); 
    }
  };

  if (isLoading) return <View style={styles.container}><ActivityIndicator color="#00FF00" /></View>;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top + 20 }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#00FF00" size="small" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {/* 🚨 NEW: Avatar Upload UI */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {newAvatarUri || avatarUrl ? (
              <Image source={{ uri: newAvatarUri || avatarUrl! }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <Text style={{fontSize: 12}}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </View>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
          placeholderTextColor="#555"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell everyone a little about yourself..."
          placeholderTextColor="#555"
          multiline={true}
          maxLength={150}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  cancelText: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  saveText: { color: '#00FF00', fontSize: 16, fontWeight: 'bold' },
  form: { padding: 20 },
  label: { color: '#888', fontSize: 14, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 25, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  // 🚨 NEW: Avatar Styles
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, position: 'relative' },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#333' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#333' },
  avatarPlaceholderText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#00FF00', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  changePhotoText: { color: '#888', fontSize: 14, marginTop: 10, fontWeight: '600' }
});