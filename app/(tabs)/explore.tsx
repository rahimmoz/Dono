import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabase';
const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [videos, setVideos] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchExploreVideos();
  }, []);

  const fetchExploreVideos = async () => {
    // We grab the video ID and the category to build the grid
    const { data } = await supabase
      .from('videos')
      .select('id, category, description, video_url, thumbnail_url') // 🚨 ADDED video_url AND thumbnail_url HERE!
      .order('created_at', { ascending: false });
    setVideos(data || []);
  };

  // Filter based on search (Matches category OR description)
  const filteredVideos = videos.filter(v => 
    (v.category?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (v.description?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* 🔍 SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories or trends..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
      </View>

          <View style={styles.trendingHeader}>
      <Text style={styles.trendingTitle}>🔥 Trending This Week</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={videos.slice(0, 5)} // Just the top 5
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.trendingCard}
            onPress={() => router.push({ pathname: '/', params: { startId: item.id } })}
          >
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={styles.trendingImage} />
            ) : (
              <View style={[styles.trendingImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 28 }}>🎬</Text>
              </View>
            )}
            <Text style={styles.trendingText} numberOfLines={1}>{item.description}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => `trending-${item.id}`}
      />
    </View>

      {/* 🖼️ THE GRID */}
      <FlatList
        data={filteredVideos}
        numColumns={3}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          // 🚨 THE MAGIC: Convert .mp4 video URL to a .jpg thumbnail URL
          const thumbnailUrl = item.video_url ? item.video_url.replace('.mp4', '.jpg') : null;

          return (
            <TouchableOpacity
              style={styles.thumbnailContainer}
              onPress={() => router.push({ pathname: '/', params: { startId: item.id } })}
            >
              <View style={styles.imageWrapper}>
                {item.thumbnail_url ? (
                  <Image 
                    source={{ uri: item.thumbnail_url }} 
                    style={StyleSheet.absoluteFill} 
                    resizeMode="cover" 
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{color: '#444', fontSize: 24}}>🎬</Text>
                  </View>
                )}

                {/* Overlaying the category so it's still readable */}
                <View style={styles.overlay}>
                  <Text style={styles.categoryBadge}>{item.category || 'General'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  searchContainer: { paddingHorizontal: 15, marginBottom: 10 },
  searchInput: { 
    backgroundColor: '#222', 
    color: '#fff', 
    padding: 12, 
    borderRadius: 25, 
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444'
  },
  thumbnailContainer: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.5,
    padding: 1, // Creates the "grid line" effect
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  overlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10,
    borderRadius: 4,
  },
  categoryBadge: { 
    color: '#00f2ea', // TikTok Teal
    fontSize: 10, 
    fontWeight: 'bold', 
    textTransform: 'uppercase',
    marginBottom: 5
  },
  descriptionSnippet: { 
    color: '#ccc', 
    fontSize: 10, 
    textAlign: 'center' 
  },
  trendingHeader: { marginBottom: 20, paddingLeft: 15 },
  trendingTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  trendingCard: { width: 120, marginRight: 15 },
  trendingImage: { width: 120, height: 180, borderRadius: 10, backgroundColor: '#222' },
  trendingText: { color: '#fff', fontSize: 12, marginTop: 5 },
});