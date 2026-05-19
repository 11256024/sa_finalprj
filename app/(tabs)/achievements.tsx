import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 💡【數據動態化】：模擬未來從資料庫（API）撈出來的數據結構
const dummyAchievements = [
  { id: '1', title: '連續 登入 七天', currentProgress: 5, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '2', title: '完成 每日 飲食紀錄', currentProgress: 3, targetTotal: 5, unlocked: false, unit: '天' },
  { id: '3', title: '喝水量 達到 2000cc', currentProgress: 1500, targetTotal: 2000, unlocked: false, unit: 'cc' }, 
  { id: '4', title: '不攝取 超標 糖分', currentProgress: 4, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '5', title: '連續 運動 三天', currentProgress: 2, targetTotal: 3, unlocked: false, unit: '天' },
  { id: '6', title: '解鎖新食譜', currentProgress: 3, targetTotal: 3, unlocked: true, unit: '道' },
  { id: '7', title: '新手上路大禮包', currentProgress: 1, targetTotal: 1, unlocked: true, unit: '次' },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const pathname = usePathname(); // 🔄 動態偵測當前路由路徑
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');

  // 👤 模擬會員頭像狀態 (與其他主要功能頁面完全同步)
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // 🌐 定義橫幅選單的名稱與對應路由 (完美對齊前幾頁)
  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // 💡 導覽列路由跳轉
  const handleMenuPress = (path: string) => {
    router.push(path as any);
  };

  // 根據 Tab 過濾資料
  const filteredAchievements = dummyAchievements.filter(item => 
    activeTab === 'unlocked' ? item.unlocked : !item.unlocked
  );

  // 動態計算總成就進度
  const unlockedCount = dummyAchievements.filter(item => item.unlocked).length;
  const totalCount = dummyAchievements.length;

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. 上方綠色導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {menuItems.map((item) => {
              // 🎯 核心高亮邏輯：動態偵測當前路徑
              const isActive = pathname === item.path;
              
              return (
                <TouchableOpacity key={item.name} onPress={() => handleMenuPress(item.path)} style={styles.menuButton}>
                  <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 👤 右上角：圓形大頭貼按鈕（與其餘主要頁面完全同步） */}
        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>林</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. 主內容包裝區 */}
      <View style={styles.mainContent}>
        
        {/* 我的成就總進度卡片 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>我 的 成 就</Text>
          <Text style={styles.summaryProgress}>已完成 {unlockedCount} / {totalCount}</Text>
        </View>

        {/* 未解鎖 / 已解鎖 頁籤切換 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'locked' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('locked')}
          >
            <Text style={[styles.tabText, activeTab === 'locked' && styles.tabTextActive]}>未 解 鎖</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'unlocked' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('unlocked')}
          >
            <Text style={[styles.tabText, activeTab === 'unlocked' && styles.tabTextActive]}>已 解 鎖</Text>
          </TouchableOpacity>
        </View>

        {/* 3. 成就列表 */}
        <View style={styles.listContainer}>
          <ScrollView 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollListContent}
          >
            {filteredAchievements.map((item) => (
              <View key={item.id} style={styles.achievementCard}>
                <View style={styles.achievementLeft}>
                  <View style={styles.iconContainer}>
                    <Feather name="award" size={26} color={activeTab === 'unlocked' ? "#FF9F6A" : "#888"} />
                  </View>
                  <Text style={styles.achievementTitle}>{item.title}</Text>
                </View>
                
                <Text style={styles.achievementProgress}>
                  {item.currentProgress} / {item.targetTotal} {item.unit}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 🎯 修正全域背景色，與專案其餘頁面色彩完全連貫
  container: { flex: 1, backgroundColor: '#F6EFE5' },
  
  /* 導覽列 */
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8, paddingBottom: 4 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },

  // 👤 圓形大頭貼按鈕樣式 (全系統設計語彙一致)
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' },

  /* 主內容容器 */
  mainContent: {
    flex: 1,
    paddingHorizontal: 80, // 與商品查詢、歷史圖表左右側安全範圍完全對齊
    paddingTop: 10,
  },
  
  /* 總進度卡片 */
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingVertical: 22,
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', letterSpacing: 2 },
  summaryProgress: { fontSize: 17, color: '#555', fontWeight: '500', letterSpacing: 1 },

  /* Tab 切換 */
  tabContainer: { flexDirection: 'row', marginBottom: 20, paddingLeft: 10 },
  tabButton: { paddingVertical: 6, marginRight: 30, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#FF9F6A' },
  tabText: { fontSize: 18, color: '#999', fontWeight: '500', letterSpacing: 1 },
  tabTextActive: { color: '#FF9F6A', fontWeight: 'bold' },

  /* 列表容器 */
  listContainer: {
    flex: 1, 
    width: '100%',
    marginBottom: 20, 
    borderRadius: 25,
    overflow: 'hidden',
  },
  scrollListContent: {
    paddingVertical: 5,
    paddingHorizontal: 2,
  },

  /* 成就卡片項目 */
  achievementCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    paddingVertical: 20, 
    paddingHorizontal: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  achievementLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 20 },
  achievementTitle: { fontSize: 17, color: '#333', fontWeight: '500', letterSpacing: 0.5 },
  achievementProgress: { fontSize: 17, color: '#666', fontWeight: '500' },
});