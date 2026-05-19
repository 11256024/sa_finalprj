import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');

  // 根據 Tab 過濾資料
  const filteredAchievements = dummyAchievements.filter(item => 
    activeTab === 'unlocked' ? item.unlocked : !item.unlocked
  );

  // 動態計算總成就進度
  const unlockedCount = dummyAchievements.filter(item => item.unlocked).length;
  const totalCount = dummyAchievements.length;

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🟢 這裡移除了重複寫死的舊 header 區塊，將控制權還給全域母版 */}

      {/* 主內容包裝區 */}
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

        {/* 成就列表 */}
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
  container: { flex: 1, backgroundColor: '#F6EFE5' },
  
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