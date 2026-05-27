import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://127.0.0.1:8001';

interface AchievementItem {
  id: string;
  category: 'login' | 'weight' | 'product';
  title: string;
  currentProgress: number;
  targetTotal: number;
  unlocked: boolean;
  unit: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending' | 'rejected';
  creatorId?: string;
}

export default function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');
  const [isLoading, setIsLoading] = useState(true);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  const getBaseBusinessDate = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const twDate = new Date(utc + 3600000 * 8);
    const hours = twDate.getHours();
    if (hours < 12) {
      twDate.setDate(twDate.getDate() - 1);
    }
    return twDate;
  };

  const formatQueryDate = (targetDate: Date) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();
    return `${year}-${month < 10 ? `0${month}` : month}-${date < 10 ? `0${date}` : date}`;
  };

  const mapProductFromApi = (item: any): Product => ({
    id: String(item.id),
    name: item.name || '',
    unit: item.unit || '',
    calories: Number(item.calories || 0),
    status: item.status || 'approved',
    creatorId: item.creator !== null && item.creator !== undefined
      ? String(item.creator)
      : (item.creator_id !== null && item.creator_id !== undefined ? String(item.creator_id) : ''),
  });

  // 🌐 【🚀 0秒閃現版】將本機與網路解耦
  const checkAndLoadAchievements = async () => {
    // 如果已經有資料，切換時就不要再顯示大轉圈圈，提升體感速度
    if (achievements.length === 0) {
      setIsLoading(true);
    }
    
    try {
      // -----------------------------------------------------------------
      // ⚖️ STEP 1: 優先極速處理本機快取 (耗時 < 2ms) -> 確保 1 秒內絕對出畫面
      // -----------------------------------------------------------------
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const id = user?.id?.toString?.() || await AsyncStorage.getItem('current_user_id') || await AsyncStorage.getItem('member_id') || '';
      const finalUserId = /^\d+$/.test(id) ? id : 'guest';

      const baseBusinessDate = getBaseBusinessDate();
      let loginStreak = 0;
      let latestActualWeight: number | null = null;

      const validDatesSet = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(baseBusinessDate);
        d.setDate(baseBusinessDate.getDate() - i);
        validDatesSet.add(formatQueryDate(d));
      }

      const allKeys = await AsyncStorage.getAllKeys();
      const targetKeys = allKeys.filter(key => {
        const isTargetPattern = key.startsWith(`${finalUserId}_food_record_`) || key.startsWith('daily_record_') || key.startsWith('food_record_');
        if (!isTargetPattern) return false;
        const datePart = key.replace(`${finalUserId}_food_record_`, '').replace('daily_record_', '').replace('food_record_', '');
        return validDatesSet.has(datePart);
      });

      if (targetKeys.length > 0) {
        const keyValuePairs = await AsyncStorage.multiGet(targetKeys);
        const records = keyValuePairs
          .map(([_, val]) => (val ? JSON.parse(val) : null))
          .filter(r => r && r.weight && parseFloat(r.weight) > 0);

        loginStreak = records.length;
        if (records.length > 0) {
          latestActualWeight = parseFloat(records[0].weight);
        }
      }

      let weightLoss = 0;
      let memberCenterWeight = 0;
      const memberProfileStr = await AsyncStorage.getItem('user_profile') || await AsyncStorage.getItem('user');
      const directWeight = await AsyncStorage.getItem(`${finalUserId}_user_weight`) || await AsyncStorage.getItem('weight');
      
      if (memberProfileStr) {
        try {
          const profile = JSON.parse(memberProfileStr);
          if (profile && profile.weight) memberCenterWeight = parseFloat(profile.weight);
        } catch {
          if (!isNaN(Number(memberProfileStr))) memberCenterWeight = parseFloat(memberProfileStr);
        }
      }
      if (memberCenterWeight === 0 && directWeight) {
        memberCenterWeight = parseFloat(directWeight);
      }

      if (memberCenterWeight > 0 && latestActualWeight !== null) {
        const diff = memberCenterWeight - latestActualWeight;
        weightLoss = diff > 0 ? Math.round(diff * 10) / 10 : 0;
      }

      // 先行讀取上次留存的商品數快取，達到 0 延遲
      const cachedProductCountStr = await AsyncStorage.getItem(`${finalUserId}_cached_product_count`);
      let approvedProductCount = cachedProductCountStr ? parseInt(cachedProductCountStr, 10) : 0;

      // 🔄 先行封裝列表，直接結束 Loading 狀態渲染畫面！
      const buildList = (pCount: number) => [
        { id: 'l1', category: 'login', title: '初來乍到 (連續紀錄體重 1 天)', currentProgress: loginStreak, targetTotal: 1, unlocked: loginStreak >= 1, unit: '天' },
        { id: 'l3', category: 'login', title: '養成習慣 (連續紀錄體重 3 天)', currentProgress: loginStreak, targetTotal: 3, unlocked: loginStreak >= 3, unit: '天' },
        { id: 'l7', category: 'login', title: '持之以恆 (連續紀錄體重 7 天)', currentProgress: loginStreak, targetTotal: 7, unlocked: loginStreak >= 7, unit: '天' },
        { id: 'l30', category: 'login', title: '自律達人 (連續紀錄體重 30 天)', currentProgress: loginStreak, targetTotal: 30, unlocked: loginStreak >= 30, unit: '天' },

        { id: 'w05', category: 'weight', title: '輕盈起步 (體重減少 0.5 KG)', currentProgress: weightLoss, targetTotal: 0.5, unlocked: weightLoss >= 0.5, unit: 'KG' },
        { id: 'w1', category: 'weight', title: '看見成效 (體重減少 1 KG)', currentProgress: weightLoss, targetTotal: 1, unlocked: weightLoss >= 1, unit: 'KG' },
        { id: 'w3', category: 'weight', title: '煥然一新 (體重減少 3 KG)', currentProgress: weightLoss, targetTotal: 3, unlocked: weightLoss >= 3, unit: 'KG' },
        { id: 'w5', category: 'weight', title: '完美蛻變 (體重減少 5 KG)', currentProgress: weightLoss, targetTotal: 5, unlocked: weightLoss >= 5, unit: 'KG' },

        { id: 'p1', category: 'product', title: '誠信商家 (審核上架商品 1 件)', currentProgress: pCount, targetTotal: 1, unlocked: pCount >= 1, unit: '件' },
        { id: 'p3', category: 'product', title: '精選賣家 (審核上架商品 3 件)', currentProgress: pCount, targetTotal: 3, unlocked: pCount >= 3, unit: '件' },
        { id: 'p5', category: 'product', title: '琳瑯滿目 (審核上架商品 5 件)', currentProgress: pCount, targetTotal: 5, unlocked: pCount >= 5, unit: '件' },
        { id: 'p10', category: 'product', title: '超級商城 (審核上架商品 10 件)', currentProgress: pCount, targetTotal: 10, unlocked: pCount >= 10, unit: '件' },
      ];

      setAchievements(buildList(approvedProductCount));
      setIsLoading(false); // 🔥 這裡直接關閉轉圈圈！畫面秒亮！

      // -----------------------------------------------------------------
      // 📦 STEP 2: 讓超級慢的 Django Fetch 在【背景】偷偷跑，絕不卡住前台
      // -----------------------------------------------------------------
      if (finalUserId !== 'guest') {
        // 使用非阻塞的立即使行函數 (IIFE) 抽離網路請求
        (async () => {
          try {
            const response = await fetch(`${API_URL}/products/?creator_id=${finalUserId}`);
            const text = await response.text();
            const data = text ? JSON.parse(text) : [];
            
            if (response.ok && Array.isArray(data)) {
              const myApprovedProducts = data
                .map(mapProductFromApi)
                .filter(product => product.creatorId === finalUserId && product.status === 'approved');
              
              const freshCount = myApprovedProducts.length;
              // 更新快取，下次進來更快
              await AsyncStorage.setItem(`${finalUserId}_cached_product_count`, String(freshCount));
              // 悄悄更新前台狀態
              setAchievements(buildList(freshCount));
            }
          } catch (e) {
            console.log('背景即時更新商品數失敗，沿用快取數據。', e);
          }
        })();
      }

    } catch (error) {
      console.error('成就館載入失敗:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAndLoadAchievements();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAndLoadAchievements();
    }, [])
  );

  const filteredAchievements = achievements.filter(item => 
    activeTab === 'unlocked' ? item.unlocked : !item.unlocked
  );

  const unlockedCount = achievements.filter(item => item.unlocked).length;
  const totalCount = achievements.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>我 的 成 就 館</Text>
          <Text style={styles.summaryProgress}>已解鎖 {unlockedCount} / {totalCount}</Text>
        </View>

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

        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FF9F6A" />
              <Text style={styles.loadingText}>讀取實際數據校正中...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {filteredAchievements.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    目前沒有{activeTab === 'unlocked' ? '已解鎖' : '未解鎖'}的成就項目
                  </Text>
                </View>
              ) : (
                filteredAchievements.map((item) => (
                  <View key={item.id} style={styles.achievementCard}>
                    <View style={styles.achievementLeft}>
                      <View style={styles.iconContainer}>
                        <Feather 
                          name={item.unlocked ? "award" : "lock"} 
                          size={26} 
                          color={item.unlocked ? "#FF9F6A" : "#B0B0B0"} 
                        />
                      </View>
                      <Text style={[styles.achievementTitle, !item.unlocked && styles.lockedTitleText]}>
                        {item.title}
                      </Text>
                    </View>
                    
                    <Text style={styles.achievementProgress}>
                      {item.currentProgress > item.targetTotal ? item.targetTotal : item.currentProgress} / {item.targetTotal} {item.unit}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6EFE5' },
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 10 },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 25, paddingVertical: 22, paddingHorizontal: 30, flexDirection: 'row', justifyBox: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  summaryTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', letterSpacing: 2 },
  summaryProgress: { fontSize: 17, color: '#555', fontWeight: '500', letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', marginBottom: 20, paddingLeft: 10 },
  tabButton: { paddingVertical: 6, marginRight: 30, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#FF9F6A' },
  tabText: { fontSize: 18, color: '#999', fontWeight: '500', letterSpacing: 1 },
  tabTextActive: { color: '#FF9F6A', fontWeight: 'bold' },
  listContainer: { flex: 1, width: '100%', marginBottom: 20, borderRadius: 25, overflow: 'hidden' },
  scrollListContent: { paddingVertical: 5, paddingHorizontal: 2 },
  achievementCard: { backgroundColor: '#FFF', borderRadius: 22, paddingVertical: 20, paddingHorizontal: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  achievementLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 20 },
  achievementTitle: { fontSize: 17, color: '#333', fontWeight: 'bold', letterSpacing: 0.5 },
  lockedTitleText: { color: '#777', fontWeight: '500' },
  achievementProgress: { fontSize: 17, color: '#666', fontWeight: '600' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 200 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666', fontWeight: '500' },
  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' }
});