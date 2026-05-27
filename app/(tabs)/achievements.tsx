import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 💡【數據動態化】：模擬未來從資料庫（API）撈出來的數據結構
const dummyAchievements = [
  // 連續登入類 (新增)
  { id: 'login_1', title: '小試身手：連續登入 1 天', currentProgress: 1, targetTotal: 1, unlocked: true, unit: '天' },
  { id: 'login_3', title: '建立習慣：連續登入 3 天', currentProgress: 1, targetTotal: 3, unlocked: false, unit: '天' },
  { id: 'login_7', title: '毅力展現：連續登入 7 天', currentProgress: 1, targetTotal: 7, unlocked: false, unit: '天' },
  { id: 'login_30', title: '自律之神：連續登入 30 天', currentProgress: 1, targetTotal: 30, unlocked: false, unit: '天' },

  // 勤奮紀錄類
  { id: '1', title: '初試啼聲：完成首次飲食紀錄', currentProgress: 1, targetTotal: 1, unlocked: true, unit: '次' }, // 已解鎖
  { id: '2', title: '完整的一天：紀錄早中晚三餐', currentProgress: 0, targetTotal: 1, unlocked: false, unit: '次' },
  { id: '3', title: '紀錄馬拉松：連續紀錄飲食', currentProgress: 3, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '4', title: '體重守門員：連續紀錄體重', currentProgress: 2, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '5', title: '全餐紀錄者：連續3天完整紀錄', currentProgress: 0, targetTotal: 3, unlocked: false, unit: '天' },
  { id: '6', title: '早餐達人：連續7天記錄早餐', currentProgress: 0, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '7', title: '午餐達人：連續7天記錄午餐', currentProgress: 0, targetTotal: 7, unlocked: false, unit: '天' },
  { id: '8', title: '晚餐達人：連續7天記錄晚餐', currentProgress: 0, targetTotal: 7, unlocked: false, unit: '天' },

  // 體重減少類 (新增)
  { id: 'loss_05', title: '輕盈開端：體重減少 0.5 KG', currentProgress: 0, targetTotal: 0.5, unlocked: false, unit: 'KG' },
  { id: 'loss_1', title: '看到成果：體重減少 1 KG', currentProgress: 0, targetTotal: 1, unlocked: false, unit: 'KG' },
  { id: 'loss_3', title: '改變體態：體重減少 3 KG', currentProgress: 0, targetTotal: 3, unlocked: false, unit: 'KG' },
  { id: 'loss_5', title: '煥然一新：體重減少 5 KG', currentProgress: 0, targetTotal: 5, unlocked: false, unit: 'KG' },

  // 健康管理類
  { id: '9', title: '熱量精算師：計算BMR/TDEE', currentProgress: 1, targetTotal: 1, unlocked: true, unit: '次' }, // 已解鎖
  { id: '10', title: '趨勢觀察家：查看體重圖表', currentProgress: 2, targetTotal: 5, unlocked: false, unit: '次' },
  { id: '11', title: '同步大師：成功同步會員資料', currentProgress: 0, targetTotal: 3, unlocked: false, unit: '次' },
  { id: '12', title: '健康達標：BMI進入正常範圍', currentProgress: 0, targetTotal: 1, unlocked: false, unit: '次' },

  // 新增商品類 (優化與新增 10 件)
  { id: '13', title: '美食探險家：新增商品 1 件', currentProgress: 1, targetTotal: 1, unlocked: true, unit: '件' }, // 已解鎖
  { id: '14', title: '商品創作者：新增商品 3 件', currentProgress: 0, targetTotal: 3, unlocked: false, unit: '件' },
  { id: '15', title: '圖庫貢獻者：新增商品 5 件', currentProgress: 0, targetTotal: 5, unlocked: false, unit: '件' },
  { id: 'prod_10', title: '供應鏈大佬：新增商品 10 件', currentProgress: 0, targetTotal: 10, unlocked: false, unit: '件' },

  // 個人化與探索類
  { id: '16', title: '個人化設定：首次填寫完整資料', currentProgress: 0, targetTotal: 1, unlocked: false, unit: '次' },
  { id: '17', title: '形象大使：上傳個人大頭貼', currentProgress: 0, targetTotal: 1, unlocked: false, unit: '次' },
  { id: '18', title: 'App探索者：訪問所有主要頁面', currentProgress: 0, targetTotal: 1, unlocked: false, unit: '次' },
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