# Dono - Social Media Donation Platform 🪙🎬

A high-performance short-form video platform built with React Native and Supabase, designed to facilitate charitable giving through a gamified "Coin" donation system.

## 🚀 Overview
Dono allows users to browse a vertical video feed, engage with creators, and send tiered donations that trigger real-time, high-impact visual animations. The platform features a fully-realized direct messaging system with real-time updates and secure database architecture.

## 🛠️ Tech Stack
- **Frontend:** React Native (Expo), TypeScript, Reanimated (for donation overlays)
- **Navigation:** Expo Router (File-based routing)
- **Backend:** Supabase (Auth, PostgreSQL, Realtime)
- **Database Security:** Row Level Security (RLS) policies for private data protection
- **UI/UX:** Safe Area Context for cross-platform Android/iOS optimization

## ✨ Key Features
- **Short Video Style Feed:** Optimized vertical scroll with snap-to-item navigation and video state management.
- **Tiered Donation System:** Integrated coin wallet with massive visual overlays (Neon effects/Whale drops) based on donation amount.
- **Real-time Direct Messaging:** Full-duplex communication using Supabase Realtime, featuring auto-scroll, message timestamps, and "Keyboard-Aware" UI.
- **Secure Architecture:** Implemented strict RLS policies to ensure users can only access their own messages and wallet data.

## 🧠 Technical Challenges & Solutions
### 📱 Android Keyboard Handling (Samsung Focus)
**Problem:** The Android system navigation and keyboard were obstructing the message input field.
**Solution:** Implemented dynamic height calculations using `useSafeAreaInsets` and adjusted `KeyboardAvoidingView` offsets to ensure a consistent experience across different device aspect ratios.

### ⚡ Real-time Synchronization
**Problem:** Messages and wallet updates needed to appear instantly without page refreshes.
**Subscription Logic:** Configured PostgreSQL replication and broadcast channels to listen for database changes, updating the local UI state in real-time.

## 🚧 Project Status
**Currently: In Progress.**
Future updates will include:
- Enhanced Video Upload pipeline with compression.
- Global Leaderboard for top donors.
- Discovery algorithm based on user interest categories.

---
*Note: This repository is a technical demonstration. API keys are managed via environment variables and are not included in the source code.*