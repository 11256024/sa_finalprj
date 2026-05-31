import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://127.0.0.1:8000';

interface AchievementItem {
  id: string;
  category: 'login' | 'weight' | 'product';
  title: string;
  currentProgress: number;
  targetTotal: number;
  unlocked: boolean;
  unit: string;
}

export default function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');
  const [isLoading, setIsLoading] = useState(true);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  // 取得基準營業日期 (台灣時間 00:00~23:59 算同一天)
  const getBaseBusinessDate = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3600000 * 8); 
  };

  // ⚡ 效能優化：用字串拼接取代極慢的 Intl.DateTimeFormat，大迴圈不卡頓
  const getTaiwanDateString = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentMemberId = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const memberId =
        currentUser?.id?.toString?.() ||
        (await AsyncStorage.getItem('current_user_id')) ||
        (await AsyncStorage.getItem('member_id')) ||
        'guest';
      return /^\d+$/.test(memberId) ? memberId : 'guest';
    } catch {
      return 'guest';
    }
  };

  // 核心數據計算邏輯 
  const calculateAndRender = (
    recordsPairs: [string, string | null][], 
    memberProfileWeight: number, // 這邊傳入的是精準的初始登記體重
    pList: any[], 
    currentUid: string
  ) => {
    const baseDate = getBaseBusinessDate();
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(baseDate.getTime());
      d.setDate(baseDate.getDate() - i);
      last30Days.push(getTaiwanDateString(d));
    }

    // 將二維陣列扁平化至 Lookup 快取物件中，實現 O(1) 查找速度
    const recordsLookup: Record<string, string> = {};
    const len = recordsPairs.length;
    for (let i = 0; i < len; i++) {
      if (recordsPairs[i][1]) {
        recordsLookup[recordsPairs[i][0]] = recordsPairs[i][1]!;
      }
    }

    // A. 連續紀錄體重天數統計
    let loginStreak = 0;
    for (let i = 0; i < 30; i++) {
      const dateStr = last30Days[i];
      const key = `${currentUid}_food_record_${dateStr}`;
      const savedDataStr = recordsLookup[key];
      let hasWeight = false;
      
      if (savedDataStr) {
        try {
          const parsed = JSON.parse(savedDataStr);
          if (parsed.hasDailyWeight === true && parsed.weight && parsed.weight.toString().trim() !== '') {
            hasWeight = true;
          }
        } catch {}
      }
      
      if (hasWeight) {
        loginStreak++;
      } else {
        break;
      }
    }

    // B. 🎯 精準對齊公式：減重斤數 = 每日最新紀錄體重 - 會員初始登記體重
    let latestDailyWeight = 0;
    let foundLatest = false;

    // 從今天往回尋找過去 30 天內最新的一筆每日體重紀錄
    for (let i = 0; i < 30; i++) {
      const dateStr = last30Days[i];
      const key = `${currentUid}_food_record_${dateStr}`;
      const savedDataStr = recordsLookup[key];
      if (savedDataStr) {
        try {
          const parsed = JSON.parse(savedDataStr);
          if (parsed.hasDailyWeight === true && parsed.weight && parsed.weight.toString().trim() !== '') {
            const w = parseFloat(parsed.weight);
            if (!isNaN(w) && w > 0) {
              latestDailyWeight = w;
              foundLatest = true;
              break; 
            }
          }
        } catch {}
      }
    }

    // 依照您的要求校正：每日紀錄減去會員初始紀錄，並轉換為合理的減重正值
    let weightLoss = 0;
    if (memberProfileWeight > 0 && foundLatest && latestDailyWeight > 0) {
      // 每日最新紀錄 - 會員初始紀錄
      const rawDiff = latestDailyWeight - memberProfileWeight;
      
      // 如果每日最新比初始會員小，代表體重減輕了，差值為負，取絕對值當作減少的公斤數
      if (rawDiff < 0) {
        weightLoss = Math.abs(rawDiff);
      } else {
        // 如果最新體重變胖或沒變，減重數值計為 0
        weightLoss = 0;
      }
    }
    weightLoss = parseFloat(weightLoss.toFixed(1));

    // C. 審核上架商品件數統計
    let pCount = 0;
    const targetUidStr = String(currentUid).trim();
    const pLen = pList.length;
    for (let i = 0; i < pLen; i++) {
      const item = pList[i];
      if (!item) continue;
      let cId = '';
      if (item.creator_id !== null && item.creator_id !== undefined) {
        cId = String(item.creator_id);
      } else if (item.creator && typeof item.creator === 'object' && item.creator.id !== undefined) {
        cId = String(item.creator.id);
      }
      const itemStatus = item.status ? String(item.status).trim().toLowerCase() : '';

      if (itemStatus === 'approved' && cId === targetUidStr) {
        pCount++;
      }
    }

    const rules = [
      { id: 'l1',  category: 'login' as const, title: '初來乍到 (連續紀錄體重 1 天)',  currentProgress: loginStreak, targetTotal: 1,  unit: '天' },
      { id: 'l3',  category: 'login' as const, title: '養成習慣 (連續紀錄體重 3 天)',  currentProgress: loginStreak, targetTotal: 3,  unit: '天' },
      { id: 'l7',  category: 'login' as const, title: '持之以恆 (連續紀錄體重 7 天)',  currentProgress: loginStreak, targetTotal: 7,  unit: '天' },
      { id: 'l30', category: 'login' as const, title: '自律達人 (連續紀錄體重 30 天)', currentProgress: loginStreak, targetTotal: 30, unit: '天' },
      { id: 'w05', category: 'weight' as const, title: '輕盈起步 (體重減少 0.5 KG)',    currentProgress: weightLoss,  targetTotal: 0.5, unit: 'KG' },
      { id: 'w1',  category: 'weight' as const, title: '看見成效 (體重減少 1 KG)',       currentProgress: weightLoss,  targetTotal: 1,   unit: 'KG' },
      { id: 'w3',  category: 'weight' as const, title: '煥然一新 (體重減少 3 KG)',       currentProgress: weightLoss,  targetTotal: 3,   unit: 'KG' },
      { id: 'w5',  category: 'weight' as const, title: '完美蛻變 (體重減少 5 KG)',       currentProgress: weightLoss,  targetTotal: 5,   unit: 'KG' },
      { id: 'p1',  category: 'product' as const, title: '誠信商家 (審架商品 1 件)',      currentProgress: pCount,      targetTotal: 1,   unit: '件' },
      { id: 'p3',  category: 'product' as const, title: '精選賣家 (審架商品 3 件)',      currentProgress: pCount,      targetTotal: 3,   unit: '件' },
      { id: 'p5',  category: 'product' as const, title: '琳瑯滿目 (審架商品 5 件)',      currentProgress: pCount,      targetTotal: 5,   unit: '件' },
      { id: 'p10', category: 'product' as const, title: '超級商城 (審架商品 10 件)',     currentProgress: pCount,      targetTotal: 10,  unit: '件' },
    ];

    return rules.map((r) => {
      let progress = r.currentProgress;
      if (progress > r.targetTotal) progress = r.targetTotal;
      return {
        id: r.id,
        category: r.category,
        title: r.title,
        currentProgress: progress,
        targetTotal: r.targetTotal,
        unlocked: r.currentProgress >= r.targetTotal,
        unit: r.unit,
      };
    });
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const runCoreLogic = async () => {
        try {
          const currentUid = await getCurrentMemberId();

          // 【秒開優化 1】讀取上一次儲存的整合快取，0 毫秒瞬間展開頁面
          const fastCachedResults = await AsyncStorage.getItem(`${currentUid}_fast_cached_achievements`);
          if (fastCachedResults && isMounted) {
            setAchievements(JSON.parse(fastCachedResults));
            setIsLoading(false);
          }

          const baseDate = getBaseBusinessDate();
          const storageKeys: string[] = [];
          for (let i = 0; i < 30; i++) {
            const d = new Date(baseDate.getTime());
            d.setDate(baseDate.getDate() - i);
            storageKeys.push(`${currentUid}_food_record_${getTaiwanDateString(d)}`);
          }

          // 🎯 精準修正對齊：從 profile.tsx 使用的 Key `${currentUid}_user_weight` 載入初始體重
          const [recordsPairs, cachedWeightStr, cachedProductsStr] = await Promise.all([
            AsyncStorage.multiGet(storageKeys),
            AsyncStorage.getItem(`${currentUid}_user_weight`), 
            AsyncStorage.getItem(`cached_global_products`)
          ]);

          let initialWeight = cachedWeightStr ? parseFloat(cachedWeightStr) : 0;
          let initialProducts: any[] = cachedProductsStr ? JSON.parse(cachedProductsStr) : [];

          if (!fastCachedResults && isMounted) {
            const initialResult = calculateAndRender(recordsPairs, initialWeight, initialProducts, currentUid);
            setAchievements(initialResult);
            setIsLoading(false);
          }

          // 【秒開優化 2】遠端網路 API 請求在背景運作
          Promise.all([
            fetch(`${API_URL}/member/profile/${currentUid}/`).then(res => res.ok ? res.json() : null).catch(() => null),
            fetch(`${API_URL}/products/`).then(res => res.ok ? res.json() : null).catch(() => null)
          ]).then(async ([profileData, productData]) => {
            if (!isMounted) return;
            let updated = false;

            // 🎯 精準修正對齊：後端傳回的欄位是 member.initial_weight
            if (profileData?.success && profileData?.member?.initial_weight) {
              const netWeight = parseFloat(profileData.member.initial_weight);
              if (netWeight !== initialWeight) {
                initialWeight = netWeight;
                updated = true;
                await AsyncStorage.setItem(`${currentUid}_user_weight`, String(netWeight));
              }
            }

            if (productData) {
              const netProducts = Array.isArray(productData) ? productData : (productData?.products || []);
              initialProducts = netProducts;
              updated = true;
              await AsyncStorage.setItem(`cached_global_products`, JSON.stringify(netProducts));
            }

            // 若背景獲取數值有變，安靜刷新 UI 並回填秒開快取
            if (updated || !fastCachedResults) {
              const finalResult = calculateAndRender(recordsPairs, initialWeight, initialProducts, currentUid);
              if (isMounted) {
                setAchievements(finalResult);
              }
              await AsyncStorage.setItem(`${currentUid}_fast_cached_achievements`, JSON.stringify(finalResult));
            }
          });

        } catch (error) {
          console.error(error);
          if (isMounted) setIsLoading(false);
        }
      };

      runCoreLogic();
      return () => { isMounted = false; };
    }, [])
  );

  const filteredAchievements = achievements.filter((item) =>
    activeTab === 'unlocked' ? item.unlocked : !item.unlocked
  );

  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const totalCount = achievements.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>我 的 成 就 總 覽</Text>
          <Text style={styles.summaryProgress}>已解鎖：{unlockedCount} / {totalCount}</Text>
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
              <Text style={styles.loadingText}>讀取實時資料中...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {filteredAchievements.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    目前沒有{activeTab === 'unlocked' ? '已解鎖' : '未解鎖'}的成就項目。
                  </Text>
                </View>
              ) : (
                filteredAchievements.map((item) => (
                  <View key={item.id} style={styles.achievementCard}>
                    <View style={styles.achievementLeft}>
                      <View style={styles.iconContainer}>
                        <Feather
                          name={item.unlocked ? 'award' : 'lock'}
                          size={26}
                          color={item.unlocked ? '#FF9F6A' : '#B0B0B0'}
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
  summaryCard: { backgroundColor: '#FFF', borderRadius: 25, paddingVertical: 22, paddingHorizontal: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
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