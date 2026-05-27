import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 對齊 Django 後端的實際監聽 Port
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

  // 🕒 中午 12 點前算前一天的業務日（對齊圖表時間演算法）
  const getBaseBusinessDate = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const twDate = new Date(utc + 3600000 * 8); // 轉台北時間

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

  // 🌟 安全 JSON 解析機制
  const parseApiResponse = async (response: any) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      console.error(`成就館解析錯誤，HTTP ${response.status}：${text.slice(0, 180)}`);
      return [];
    }
  };

  // 🌟 智慧欄位對照過濾器
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

  // 🌐 【實際數據核對與連動引擎】
  const checkAndLoadAchievements = async () => {
    setIsLoading(true);
    try {
      // 1. 獲取目前登入會員 ID
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const id =
        user?.id?.toString?.() ||
        (await AsyncStorage.getItem('current_user_id')) ||
        (await AsyncStorage.getItem('member_id')) ||
        '';
      const finalUserId = /^\d+$/.test(id) ? id : 'guest';

      const baseBusinessDate = getBaseBusinessDate();

      // ==========================================
      // ⚖️ 體重數據連動核心：【會員中心體重】 - 【每日紀錄體重】
      // ==========================================
      let loginStreak = 0;
      let latestActualWeight: number | null = null; 

      // A. 往回追溯 30 天，精準抓取「最新一筆每日紀錄的體重」
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(baseBusinessDate);
        checkDate.setDate(baseBusinessDate.getDate() - i);
        const dateStr = formatQueryDate(checkDate);

        // 🔍 自動多重適應每日紀錄的 Key 命名模式
        const recordStr = 
          await AsyncStorage.getItem(`${finalUserId}_food_record_${dateStr}`) ||
          await AsyncStorage.getItem(`daily_record_${dateStr}`) ||
          await AsyncStorage.getItem(`food_record_${dateStr}`);
        
        if (recordStr) {
          const parsed = JSON.parse(recordStr);
          // 增強容錯：只要當天紀錄裡有填寫大於 0 的體重，即代表有留下紀錄
          if (parsed && parsed.weight && parseFloat(parsed.weight) > 0) {
            loginStreak++;
            // 抓取離今天最近、最新的一筆實際輸入體重
            if (latestActualWeight === null) {
              latestActualWeight = parseFloat(parsed.weight);
            }
          } else {
            if (i > 0) break; // 若過去某天漏填，則連續天數在中斷點截止
          }
        } else {
          if (i > 0) break;
        }
      }

      // B. 抓取「會員中心」設定的基準/初始體重
      let weightLoss = 0;
      let memberCenterWeight = 0;

      // 🔍 自動多重適應會員中心可能儲存的基本資料 Key
      const memberProfileStr = await AsyncStorage.getItem('user_profile') || await AsyncStorage.getItem('user');
      const directWeight = await AsyncStorage.getItem(`${finalUserId}_user_weight`) || await AsyncStorage.getItem('weight');
      
      if (memberProfileStr) {
        try {
          const profile = JSON.parse(memberProfileStr);
          if (profile && profile.weight) {
            memberCenterWeight = parseFloat(profile.weight);
          }
        } catch (e) {
          // 如果 user_profile 本身就是純數字字串
          if (!isNaN(Number(memberProfileStr))) {
            memberCenterWeight = parseFloat(memberProfileStr);
          }
        }
      }
      
      // 備用方案：若 profile 沒抓到，嘗試抓單獨存放的 weight key
      if (memberCenterWeight === 0 && directWeight) {
        memberCenterWeight = parseFloat(directWeight);
      }

      // C. 執行減重變化連動公式：會員中心設定值 - 每日紀錄最新值
      if (memberCenterWeight > 0 && latestActualWeight !== null) {
        const diff = memberCenterWeight - latestActualWeight;
        // 只有每日紀錄比會員中心輕（成功減重）時才顯示正減少量，四捨五入到小數第一位
        weightLoss = diff > 0 ? Math.round(diff * 10) / 10 : 0;
        console.log(`[體重連動成功] 會員中心: ${memberCenterWeight}KG | 每日紀錄: ${latestActualWeight}KG | 減重變化: ${weightLoss}KG`);
      }

      // ==========================================
      // 📦 實際上架商品數據檢測 (100% 依據 Django 真實狀態)
      // ==========================================
      let approvedProductCount = 0;
      if (finalUserId !== 'guest') {
        try {
          const response = await fetch(`${API_URL}/products/`);
          const data = await parseApiResponse(response);
          
          if (response.ok && Array.isArray(data)) {
            const myApprovedProducts = data
              .map(mapProductFromApi)
              .filter(product => product.creatorId === finalUserId && product.status === 'approved');
            
            approvedProductCount = myApprovedProducts.length;
          }
        } catch (e) {
          console.log('後端連線失敗，商品進度重設為 0。', e);
          approvedProductCount = 0; 
        }
      }

      // ==========================================
      // 🏆 根據真實數據封裝 12 大成就項目
      // ==========================================
      const updatedList: AchievementItem[] = [
        // 🔥 連續紀錄體重
        { id: 'l1', category: 'login', title: '初來乍到 (連續紀錄體重 1 天)', currentProgress: loginStreak, targetTotal: 1, unlocked: loginStreak >= 1, unit: '天' },
        { id: 'l3', category: 'login', title: '養成習慣 (連續紀錄體重 3 天)', currentProgress: loginStreak, targetTotal: 3, unlocked: loginStreak >= 3, unit: '天' },
        { id: 'l7', category: 'login', title: '持之以恆 (連續紀錄體重 7 天)', currentProgress: loginStreak, targetTotal: 7, unlocked: loginStreak >= 7, unit: '天' },
        { id: 'l30', category: 'login', title: '自律達人 (連續紀錄體重 30 天)', currentProgress: loginStreak, targetTotal: 30, unlocked: loginStreak >= 30, unit: '天' },

        // ⚖️ 體重減少進度
        { id: 'w05', category: 'weight', title: '輕盈起步 (體重減少 0.5 KG)', currentProgress: weightLoss, targetTotal: 0.5, unlocked: weightLoss >= 0.5, unit: 'KG' },
        { id: 'w1', category: 'weight', title: '看見成效 (體重減少 1 KG)', currentProgress: weightLoss, targetTotal: 1, unlocked: weightLoss >= 1, unit: 'KG' },
        { id: 'w3', category: 'weight', title: '煥然一新 (體重減少 3 KG)', currentProgress: weightLoss, targetTotal: 3, unlocked: weightLoss >= 3, unit: 'KG' },
        { id: 'w5', category: 'weight', title: '完美蛻變 (體重減少 5 KG)', currentProgress: weightLoss, targetTotal: 5, unlocked: weightLoss >= 5, unit: 'KG' },

        // 📦 實際上架商品
        { id: 'p1', category: 'product', title: '誠信商家 (審核上架商品 1 件)', currentProgress: approvedProductCount, targetTotal: 1, unlocked: approvedProductCount >= 1, unit: '件' },
        { id: 'p3', category: 'product', title: '精選賣家 (審核上架商品 3 件)', currentProgress: approvedProductCount, targetTotal: 3, unlocked: approvedProductCount >= 3, unit: '件' },
        { id: 'p5', category: 'product', title: '琳瑯滿目 (審核上架商品 5 件)', currentProgress: approvedProductCount, targetTotal: 5, unlocked: approvedProductCount >= 5, unit: '件' },
        { id: 'p10', category: 'product', title: '超級商城 (審核上架商品 10 件)', currentProgress: approvedProductCount, targetTotal: 10, unlocked: approvedProductCount >= 10, unit: '件' },
      ];

      setAchievements(updatedList);
    } catch (error) {
      console.error('成就館實際數據載入失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 監聽網頁與頁面重焦切換，確保即時動態計算
  useEffect(() => {
    checkAndLoadAchievements();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWindowFocus = () => checkAndLoadAchievements();
      window.addEventListener('focus', handleWindowFocus);
      return () => {
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
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
        
        {/* 我的成就總進度卡片 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>我 的 成 就 館</Text>
          <Text style={styles.summaryProgress}>已解鎖 {unlockedCount} / {totalCount}</Text>
        </View>

        {/* 頁籤切換 */}
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

        {/* 成就清單 */}
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
                    
                    {/* 修正後的進度渲染區（包含防止進度破表與補上 item. 作用域） */}
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
  tabContainer: { flexDirection: 'row', marginBottom: 20, paddingLeft: 10 },
  tabButton: { paddingVertical: 6, marginRight: 30, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#FF9F6A' },
  tabText: { fontSize: 18, color: '#999', fontWeight: '500', letterSpacing: 1 },
  tabTextActive: { color: '#FF9F6A', fontWeight: 'bold' },
  listContainer: { flex: 1, width: '100%', marginBottom: 20, borderRadius: 25, overflow: 'hidden' },
  scrollListContent: { paddingVertical: 5, paddingHorizontal: 2 },
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
  achievementTitle: { fontSize: 17, color: '#333', fontWeight: 'bold', letterSpacing: 0.5 },
  lockedTitleText: { color: '#777', fontWeight: '500' },
  achievementProgress: { fontSize: 17, color: '#666', fontWeight: '600' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 200 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666', fontWeight: '500' },
  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' }
});