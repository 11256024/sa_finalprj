import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');

  // 💡 導覽列路由
  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') {
      router.push('/profile');
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');
    } else if (menuName === '歷史紀錄') {
      router.push('/history');
    } else if (menuName === '身體指數查詢') {
      router.push('/body-metrics');
    } else if (menuName === '查詢商品') {
      router.push('/products');
    } else if (menuName === '成就管理') {
      router.push('/achievements');
    }
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
          <TouchableOpacity onPress={() => handleMenuPress('首頁')}>
            <Text style={styles.headerTitle}>食半功倍</Text>
          </TouchableOpacity>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[
                  styles.headerMenu, 
                  item === '成就管理' && { fontWeight: 'bold', textDecorationLine: 'underline' }
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 右側會員中心按鈕 - 完全參照身體指數查詢的樣式代碼 */}
        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
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
                    <Feather name="award" size={26} color="#666" />
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
  container: { flex: 1, backgroundColor: '#F9F1E7' },
  
  /* 導覽列 */
  header: { 
    height: 100, 
    backgroundColor: '#A3C1AD', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 30,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500' },

  /* 🎯 完美同步：完全參照身體指數查詢的會員中心按鈕樣式 */
  memberCenterBtn: { 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.5)' 
  },
  memberCenterText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },

  /* 主內容容器 */
  mainContent: {
    flex: 1,
    paddingHorizontal: 40,
  },
  
  /* 總進度卡片 */
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingVertical: 20,
    paddingHorizontal: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: { fontSize: 20, fontWeight: '600', color: '#333', letterSpacing: 2 },
  summaryProgress: { fontSize: 16, color: '#333', letterSpacing: 1 },

  /* Tab 切換 */
  tabContainer: { flexDirection: 'row', marginBottom: 15, paddingLeft: 15 },
  tabButton: { paddingVertical: 6, marginRight: 25, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#FF9F6A' },
  tabText: { fontSize: 16, color: '#999', fontWeight: '500' },
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
    borderRadius: 25,
    paddingVertical: 18, 
    paddingHorizontal: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  achievementLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 15 },
  achievementTitle: { fontSize: 16, color: '#333', fontWeight: '500' },
  achievementProgress: { fontSize: 16, color: '#333' },
});