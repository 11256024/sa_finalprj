// 檔案說明：成就頁面：計算使用者的連續紀錄、減重與商品審核成就，並顯示已解鎖/未解鎖清單。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';

// 說明：AchievementItem 定義這個頁面會使用的資料欄位與型別。
interface AchievementItem {
  id: string;
  category: 'login' | 'weight' | 'product';
  title: string;
  currentProgress: number;
  targetTotal: number;
  unlocked: boolean;
  unit: string;
}

// 說明：AchievementsScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState<'locked' | 'unlocked'>('locked');
  const [isLoading, setIsLoading] = useState(true);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  // 🎯 體重控制成就看板相關 state
  const [achievementStartWeight, setAchievementStartWeight] = useState<number>(0);
  const [currentWeight, setCurrentWeight] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [inputWeight, setInputWeight] = useState<string>('');

  // 🎯 獲取全局體重更新信號
  const { weightUpdateVersion, lastWeightValue } = useDataContext();

  const [cachedRecords, setCachedRecords] = useState<[string, string | null][]>([]);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);

  // 🎯 精準對齊 history.tsx 的台灣時間基準
  // 說明：宣告 getBaseBusinessDate，集中處理這段畫面邏輯會用到的資料或方法。
  const getBaseBusinessDate = () => {
    // 說明：宣告 now，集中處理這段畫面邏輯會用到的資料或方法。
    const now = new Date();
    // 說明：宣告 utc，集中處理這段畫面邏輯會用到的資料或方法。
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3600000 * 8); 
  };

  // 🎯 精準對齊 history.tsx 的 YYYY-MM-DD 補零格式
  // 說明：宣告 getTaiwanDateString，集中處理這段畫面邏輯會用到的資料或方法。
  const getTaiwanDateString = (dateObj: Date) => {
    // 說明：宣告 year，集中處理這段畫面邏輯會用到的資料或方法。
    const year = dateObj.getFullYear();
    // 說明：宣告 month，集中處理這段畫面邏輯會用到的資料或方法。
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    // 說明：宣告 day，集中處理這段畫面邏輯會用到的資料或方法。
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 說明：讀取目前登入者 ID，之後用來組 AsyncStorage key 或呼叫會員 API。
  const getCurrentMemberId = async () => {
    try {
      // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
      const userStr = await AsyncStorage.getItem('user');
      // 說明：宣告 currentUser，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUser = userStr ? JSON.parse(userStr) : null;
      // 說明：宣告 memberId，集中處理這段畫面邏輯會用到的資料或方法。
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

  // 核心數據計算邏輯 (完美融合本地與後端數據)
  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateAndRender = (
    recordsPairs: [string, string | null][], 
    baseWeight: number, 
    pList: any[], 
    currentUid: string,
    profileWeight: number,
    backendSummaryData: Record<string, any> = {} // 新增：承接後端30天同步對齊
  ) => {
    // 說明：宣告 baseDate，集中處理這段畫面邏輯會用到的資料或方法。
    const baseDate = getBaseBusinessDate();
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      // 說明：宣告 d，集中處理這段畫面邏輯會用到的資料或方法。
      const d = new Date(baseDate.getTime());
      d.setDate(baseDate.getDate() - i);
      last30Days.push(getTaiwanDateString(d));
    }

    // 將所有 AsyncStorage 的 key-value 轉成 Lookup 物件
    const recordsLookup: Record<string, string> = {};
    // 說明：宣告 len，集中處理這段畫面邏輯會用到的資料或方法。
    const len = recordsPairs.length;
    for (let i = 0; i < len; i++) {
      if (recordsPairs[i][1]) {
        recordsLookup[recordsPairs[i][0]] = recordsPairs[i][1]!;
      }
    }

    // 1. 🎯 點名統計：融合本地與後端雙重管道檢測
    let loginStreak = 0;
    for (let i = 0; i < 30; i++) {
      // 說明：宣告 dateStr，集中處理這段畫面邏輯會用到的資料或方法。
      const dateStr = last30Days[i];
      // 說明：宣告 foodKey，集中處理這段畫面邏輯會用到的資料或方法。
      const foodKey = `${currentUid}_food_record_${dateStr}`;
      // 說明：宣告 weightKey，集中處理這段畫面邏輯會用到的資料或方法。
      const weightKey = `${currentUid}_weight_${dateStr}`;
      
      // 說明：宣告 savedFoodStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedFoodStr = recordsLookup[foodKey];
      // 說明：宣告 savedWeightStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedWeightStr = recordsLookup[weightKey];
      
      let hasWeightOrFood = false;

      // 管道 A：檢查本地飲食紀錄物件
      if (savedFoodStr) {
        try {
          // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
          const parsed = JSON.parse(savedFoodStr);
          if (parsed.weight && parsed.weight.toString().trim() !== '' && parseFloat(parsed.weight) > 0) {
            hasWeightOrFood = true;
          }
        } catch {}
      }

      // 管道 B：檢查本地獨立體重紀錄欄位
      if (!hasWeightOrFood && savedWeightStr && savedWeightStr.trim() !== '') {
        // 說明：宣告 wVal，集中處理這段畫面邏輯會用到的資料或方法。
        const wVal = parseFloat(savedWeightStr);
        if (!isNaN(wVal) && wVal > 0) {
          hasWeightOrFood = true;
        }
      }

      // 管道 C：整合檢查後端回傳的歷史數據（修正關鍵！）
      // 說明：宣告 fromBackend，集中處理這段畫面邏輯會用到的資料或方法。
      const fromBackend = backendSummaryData[dateStr];
      if (!hasWeightOrFood && fromBackend) {
        if (fromBackend.weight && fromBackend.weight.toString().trim() !== '') {
          hasWeightOrFood = true;
        } else if (fromBackend.meals) {
          // 說明：宣告 backendHasAny，集中處理這段畫面邏輯會用到的資料或方法。
          const backendHasAny =
            (fromBackend.meals['早餐']?.length || 0) +
            (fromBackend.meals['午餐']?.length || 0) +
            (fromBackend.meals['晚餐']?.length || 0) > 0;
          if (backendHasAny) {
            hasWeightOrFood = true;
          }
        }
      }

      if (hasWeightOrFood) {
        loginStreak++;
      } else {
        // 如果需要 30 天內有記就累積（不中斷），可以註解掉這行 break
        break; 
      }
    }

    // 2. 尋找最近一筆有效的體重數值（同步支援後端撈取）
    let latestDailyWeight = 0;
    let foundLatest = false;

    for (let i = 0; i < 30; i++) {
      // 說明：宣告 dateStr，集中處理這段畫面邏輯會用到的資料或方法。
      const dateStr = last30Days[i];
      // 說明：宣告 foodKey，集中處理這段畫面邏輯會用到的資料或方法。
      const foodKey = `${currentUid}_food_record_${dateStr}`;
      // 說明：宣告 weightKey，集中處理這段畫面邏輯會用到的資料或方法。
      const weightKey = `${currentUid}_weight_${dateStr}`;

      // 說明：宣告 savedFoodStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedFoodStr = recordsLookup[foodKey];
      // 說明：宣告 savedWeightStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedWeightStr = recordsLookup[weightKey];

      if (savedFoodStr) {
        try {
          // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
          const parsed = JSON.parse(savedFoodStr);
          if (parsed.weight && parsed.weight.toString().trim() !== '') {
            // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
            const w = parseFloat(parsed.weight);
            if (!isNaN(w) && w > 0) {
              latestDailyWeight = w;
              foundLatest = true;
              break;
            }
          }
        } catch {}
      }

      if (savedWeightStr && savedWeightStr.trim() !== '') {
        // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
        const w = parseFloat(savedWeightStr);
        if (!isNaN(w) && w > 0) {
          latestDailyWeight = w;
          foundLatest = true;
          break;
        }
      }

      // 說明：宣告 fromBackend，集中處理這段畫面邏輯會用到的資料或方法。
      const fromBackend = backendSummaryData[dateStr];
      if (fromBackend && fromBackend.weight && parseFloat(fromBackend.weight) > 0) {
        latestDailyWeight = parseFloat(fromBackend.weight);
        foundLatest = true;
        break;
      }
    }

    // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
    const currentWeightForCalc = foundLatest ? latestDailyWeight : profileWeight;

    let weightLoss = 0;
    if (baseWeight > 0 && currentWeightForCalc > 0) {
      // 說明：宣告 rawDiff，集中處理這段畫面邏輯會用到的資料或方法。
      const rawDiff = currentWeightForCalc - baseWeight;
      if (rawDiff < 0) {
        weightLoss = Math.abs(rawDiff);
      }
    }
    weightLoss = parseFloat(weightLoss.toFixed(1));

    if (foundLatest) {
      setCurrentWeight(latestDailyWeight);
    } else if (profileWeight > 0) {
      setCurrentWeight(profileWeight);
    }

    // 商品審核數統計
    let pCount = 0;
    // 說明：宣告 targetUidStr，集中處理這段畫面邏輯會用到的資料或方法。
    const targetUidStr = String(currentUid).trim();
    // 說明：宣告 pLen，集中處理這段畫面邏輯會用到的資料或方法。
    const pLen = pList.length;
    for (let i = 0; i < pLen; i++) {
      // 說明：宣告 item，集中處理這段畫面邏輯會用到的資料或方法。
      const item = pList[i];
      if (!item) continue;
      let cId = '';
      if (item.creator_id !== null && item.creator_id !== undefined) {
        cId = String(item.creator_id);
      } else if (item.creator && typeof item.creator === 'object' && item.creator.id !== undefined) {
        cId = String(item.creator.id);
      }
      // 說明：提供畫面下拉選單或清單渲染使用的固定資料。
      const itemStatus = item.status ? String(item.status).trim().toLowerCase() : '';

      if (itemStatus === 'approved' && cId === targetUidStr) {
        pCount++;
      }
    }

    // 說明：宣告 rules，集中處理這段畫面邏輯會用到的資料或方法。
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

  // 說明：把前端目前資料同步到後端或其他頁面共用狀態。
  const syncAchievementsToBackend = async (currentUid: string, items: AchievementItem[]) => {
    if (currentUid === 'guest') return;
    // 說明：宣告 unlockedCodes，集中處理這段畫面邏輯會用到的資料或方法。
    const unlockedCodes = items.filter(it => it.unlocked).map(it => it.id);
    if (unlockedCodes.length === 0) return;

    try {
      await fetch(`${API_URL}/achievements/unlock/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: currentUid, codes: unlockedCodes }),
      });
    } catch (err) {
      console.log('同步成就解鎖到後端失敗:', err);
    }
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      refreshAllData(isMounted);
      return () => { isMounted = false; };
    }, [])
  );

  // 說明：宣告 refreshAllData，集中處理這段畫面邏輯會用到的資料或方法。
  const refreshAllData = async (isMounted: boolean) => {
    try {
      // 說明：宣告 currentUid，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUid = await getCurrentMemberId();

      const [cachedStartWeightStr, cachedProfileWeightStr, fastCachedResults, cachedProductsStr] = await Promise.all([
        AsyncStorage.getItem(`${currentUid}_achievement_start_weight`),
        AsyncStorage.getItem(`${currentUid}_user_weight`),
        AsyncStorage.getItem(`${currentUid}_fast_cached_achievements`),
        AsyncStorage.getItem(`cached_global_products`)
      ]);

      let startWeight = cachedStartWeightStr ? parseFloat(cachedStartWeightStr) : 0;
      let profileWeight = cachedProfileWeightStr ? parseFloat(cachedProfileWeightStr) : 0;
      let initialProducts: any[] = cachedProductsStr ? JSON.parse(cachedProductsStr) : [];

      if (fastCachedResults && isMounted) {
        setAchievements(JSON.parse(fastCachedResults));
        setAchievementStartWeight(startWeight);
        setIsLoading(false);
      }

      // 抓取全量本地快取進行首輪處理
      // 說明：宣告 allKeys，集中處理這段畫面邏輯會用到的資料或方法。
      const allKeys = await AsyncStorage.getAllKeys();
      // 說明：宣告 matchedKeys，集中處理這段畫面邏輯會用到的資料或方法。
      const matchedKeys = allKeys.filter(k => 
        k.includes(`${currentUid}_food_record_`) || k.includes(`${currentUid}_weight_`)
      );
      // 說明：宣告 recordsPairs，集中處理這段畫面邏輯會用到的資料或方法。
      const recordsPairs = await AsyncStorage.multiGet(matchedKeys);

      if (isMounted) {
        setCachedRecords(recordsPairs as [string, string | null][]);
        setCachedProducts(initialProducts);
        
        // 說明：宣告 firstResult，集中處理這段畫面邏輯會用到的資料或方法。
        const firstResult = calculateAndRender(recordsPairs as [string, string | null][], startWeight, initialProducts, currentUid, profileWeight);
        setAchievements(firstResult);
        setAchievementStartWeight(startWeight);
        setIsLoading(false);
      }

      // 🎯 核心補強：完美複製 history.tsx 的 30天後端同步邏輯 
      // 說明：宣告 isRealMember，集中處理這段畫面邏輯會用到的資料或方法。
      const isRealMember = /^\d+$/.test(currentUid);
      if (isRealMember) {
        fetch(`${API_URL}/daily/summary/?member_id=${currentUid}&days=30`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.success && Array.isArray(data.records) && isMounted) {
              const backendRecordsByDate: Record<string, any> = {};
              data.records.forEach((r: any) => {
                backendRecordsByDate[r.date] = {
                  weight: r.weight || '',
                  bmi: r.bmi || '',
                  meals: r.meals || { 早餐: [], 午餐: [], 晚餐: [] },
                };
              });
              
              // 帶入後端三十天數據重新渲染！完美對齊 history 畫面！
              // 說明：宣告 finalResult，集中處理這段畫面邏輯會用到的資料或方法。
              const finalResult = calculateAndRender(recordsPairs as [string, string | null][], startWeight, initialProducts, currentUid, profileWeight, backendRecordsByDate);
              setAchievements(finalResult);
              syncAchievementsToBackend(currentUid, finalResult);
              AsyncStorage.setItem(`${currentUid}_fast_cached_achievements`, JSON.stringify(finalResult));
            }
          })
          .catch(e => console.log('成就系統背景同步後端飲食概要失敗:', e));
      }

      // 獲取個人體重出發點配置
      fetch(`${API_URL}/member/profile/${currentUid}/`)
        .then(res => res.ok ? res.json() : null)
        .then(async (profileData) => {
          if (!isMounted || !profileData?.success) return;
          
          // 說明：宣告 backendAchieveStart，集中處理這段畫面邏輯會用到的資料或方法。
          const backendAchieveStart = profileData.member.achievement_start_weight ? parseFloat(profileData.member.achievement_start_weight) : null;
          // 說明：宣告 backendInitialWeight，集中處理這段畫面邏輯會用到的資料或方法。
          const backendInitialWeight = profileData.member.initial_weight ? parseFloat(profileData.member.initial_weight) : null;

          let finalSyncWeight = startWeight;
          if (backendAchieveStart !== null) {
            finalSyncWeight = backendAchieveStart;
          } else if (startWeight === 0 && backendInitialWeight !== null) {
            finalSyncWeight = backendInitialWeight;
          }

          if (finalSyncWeight !== startWeight && finalSyncWeight !== 0) {
            await AsyncStorage.setItem(`${currentUid}_achievement_start_weight`, String(finalSyncWeight));
            if (isMounted) {
              setAchievementStartWeight(finalSyncWeight);
              // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
              const reCalc = calculateAndRender(recordsPairs as [string, string | null][], finalSyncWeight, initialProducts, currentUid, profileWeight);
              setAchievements(reCalc);
              syncAchievementsToBackend(currentUid, reCalc);
            }
          }
        }).catch(() => null);

    } catch (error) {
      console.error(error);
      if (isMounted) setIsLoading(false);
    }
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    if (lastWeightValue) {
      // 說明：宣告 newW，集中處理這段畫面邏輯會用到的資料或方法。
      const newW = parseFloat(lastWeightValue);
      if (!isNaN(newW)) setCurrentWeight(newW);
    }
    refreshAllData(true); 
  }, [weightUpdateVersion]);

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleCancelReset = () => {
    if (inputWeight.trim() !== '') {
      setCancelModalVisible(true);
    } else {
      setModalVisible(false);
      setInputWeight('');
    }
  };

  // 說明：依照關鍵字或頁籤條件篩選要顯示的資料。
  const filteredAchievements = achievements.filter((item) =>
    activeTab === 'unlocked' ? item.unlocked : !item.unlocked
  );

  // 說明：宣告 unlockedCount，集中處理這段畫面邏輯會用到的資料或方法。
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  // 說明：宣告 totalCount，集中處理這段畫面邏輯會用到的資料或方法。
  const totalCount = achievements.length;

  // 說明：宣告 weightDiff，集中處理這段畫面邏輯會用到的資料或方法。
  const weightDiff = (currentWeight > 0 && achievementStartWeight > 0)
    ? parseFloat((currentWeight - achievementStartWeight).toFixed(1))
    : 0;

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleApplyTodayWeight = async () => {
    try {
      // 說明：宣告 currentUid，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUid = await getCurrentMemberId();
      // 說明：宣告 baseDate，集中處理這段畫面邏輯會用到的資料或方法。
      const baseDate = getBaseBusinessDate();
      // 說明：宣告 todayStr，集中處理這段畫面邏輯會用到的資料或方法。
      const todayStr = getTaiwanDateString(baseDate);
      
      let todayWeight = 0;
      // 說明：宣告 foodVal，集中處理這段畫面邏輯會用到的資料或方法。
      const foodVal = await AsyncStorage.getItem(`${currentUid}_food_record_${todayStr}`);
      // 說明：宣告 weightVal，集中處理這段畫面邏輯會用到的資料或方法。
      const weightVal = await AsyncStorage.getItem(`${currentUid}_weight_${todayStr}`);

      if (foodVal) {
        try {
          // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
          const parsed = JSON.parse(foodVal);
          if (parsed.weight) todayWeight = parseFloat(parsed.weight);
        } catch {}
      }
      if (todayWeight === 0 && weightVal) {
        // 說明：宣告 wVal，集中處理這段畫面邏輯會用到的資料或方法。
        const wVal = parseFloat(weightVal);
        if (!isNaN(wVal)) todayWeight = wVal;
      }

      if (todayWeight > 0) {
        setInputWeight(String(todayWeight));
      } else {
        Alert.alert('提示', '今日尚無體重紀錄，請手動輸入');
      }
    } catch (error) {
      console.log('讀取今日體重失敗:', error);
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleConfirmWeightChange = async () => {
    try {
      // 說明：宣告 newWeight，集中處理這段畫面邏輯會用到的資料或方法。
      const newWeight = parseFloat(inputWeight);
      if (isNaN(newWeight) || newWeight <= 0) {
        Alert.alert('錯誤', '請輸入有效的體重數值');
        return;
      }

      // 說明：宣告 currentUid，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUid = await getCurrentMemberId();
      if (currentUid === 'guest') {
        Alert.alert('錯誤', '請先登入');
        return;
      }

      await AsyncStorage.setItem(`${currentUid}_achievement_start_weight`, String(newWeight));
      setAchievementStartWeight(newWeight);
      
      // 說明：宣告 updatedResult，集中處理這段畫面邏輯會用到的資料或方法。
      const updatedResult = calculateAndRender(cachedRecords, newWeight, cachedProducts, currentUid, currentWeight);
      setAchievements(updatedResult);
      syncAchievementsToBackend(currentUid, updatedResult);
      
      setModalVisible(false);
      setInputWeight('');

      try {
        await fetch(`${API_URL}/member/achievement-weight/${currentUid}/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievement_start_weight: newWeight }),
        });
      } catch (netErr) {
        console.log('同步到後端失敗，但本機已保存:', netErr);
      }

      Alert.alert('成功', `成就起點已更新為 ${newWeight} kg`);
    } catch (error) {
      Alert.alert('錯誤', '更新失敗，請稍後重試');
      console.error(error);
    }
  };

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>

        {/* 🎯 體重控制成就看板 */}
        <View style={styles.weightControlCard}>
          <View style={styles.weightCardHeader}>
            <Text style={styles.weightCardTitle}>⚖️ 體重控制成就</Text>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => {
                setInputWeight('');
                setModalVisible(true);
              }}
            >
              <MaterialCommunityIcons name="cog" size={20} color="#E67E22" />
              <Text style={styles.resetButtonText}>重設起點</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightStatsRow}>
            <View style={styles.weightStatBox}>
              <Text style={styles.weightStatLabel}>起跑體重</Text>
              <Text style={styles.weightStatValue}>{achievementStartWeight > 0 ? achievementStartWeight.toFixed(1) : '—'} kg</Text>
            </View>

            <View style={styles.weightStatBox}>
              <Text style={styles.weightStatLabel}>目前體重</Text>
              <Text style={styles.weightStatValue}>{currentWeight > 0 ? currentWeight.toFixed(1) : '—'} kg</Text>
            </View>

            <View style={[styles.weightStatBox, styles.weightLossBox, { borderLeftWidth: 1, borderLeftColor: '#F0F0F0' }]}>
              <Text style={styles.weightStatLabel}>累積減重</Text>
              <Text style={[
                styles.weightLossValue,
                weightDiff > 0 ? { color: '#E74C3C' } : weightDiff < 0 ? { color: '#2ECC71' } : {}
              ]}>
                {weightDiff > 0 ? `+${weightDiff}` : (weightDiff < 0 ? `${weightDiff}` : '0')} kg
              </Text>
            </View>
          </View>
        </View>

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
                      <Text style={[styles.achievementTitle, !item.unlocked && styles.lockedTitleText]} numberOfLines={1}>
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

      {/* 🎯 重設起點 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚖️ 重設減重起點</Text>
            <Text style={styles.modalDescription}>
              您可以重新設定減重的出發點。系統將會以新設定的體重為基準，來計算您的減重成就。
            </Text>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={handleApplyTodayWeight}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="white" />
              <Text style={styles.quickActionButtonText}>套用今日體重</Text>
            </TouchableOpacity>

            <View style={styles.manualInputSection}>
              <Text style={styles.manualInputLabel}>或手動輸入體重：</Text>
              <TextInput
                style={styles.weightInput}
                placeholder="請輸入體重 (kg)"
                placeholderTextColor="#CCC"
                keyboardType="decimal-pad"
                value={inputWeight}
                onChangeText={setInputWeight}
              />
            </View>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelReset}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmWeightChange}
              >
                <Text style={styles.confirmButtonText}>確認變更</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🎯 取消編輯確認彈窗 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={cancelModalVisible}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ 確認要取消編輯嗎？</Text>
            <Text style={styles.modalDescription}>您尚未儲存的變更內容將會遺失。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setCancelModalVisible(false);
                  setModalVisible(false);
                  setInputWeight('');
                }}
              >
                <Text style={styles.confirmButtonText}>確定取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6EFE5' },
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 10 },
  weightControlCard: { backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  weightCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  weightCardTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  resetButton: { flexDirection: 'row', alignItems: 'center' },
  resetButtonText: { fontSize: 12, fontWeight: '600', color: '#E67E22', marginLeft: 6 },
  weightStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  weightStatBox: { flex: 1, alignItems: 'center' },
  weightLossBox: {},
  weightStatLabel: { fontSize: 11, fontWeight: '500', color: '#888', marginBottom: 2 },
  weightStatValue: { fontSize: 18, fontWeight: '700', color: '#333' },
  weightLossValue: { fontSize: 18, fontWeight: '700', color: '#3498DB' },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 25, paddingVertical: 15, paddingHorizontal: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  summaryProgress: { fontSize: 15, color: '#555', fontWeight: '500' },
  tabContainer: { flexDirection: 'row', marginBottom: 15, paddingLeft: 10 },
  tabButton: { paddingVertical: 6, marginRight: 30, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: '#FF9F6A' },
  tabText: { fontSize: 16, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#FF9F6A', fontWeight: 'bold' },
  listContainer: { flex: 1, width: '100%', marginBottom: 20, borderRadius: 25, overflow: 'hidden' },
  scrollListContent: { paddingVertical: 5, paddingHorizontal: 2 },
  achievementCard: { backgroundColor: '#FFF', borderRadius: 22, paddingVertical: 15, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  achievementLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconContainer: { marginRight: 20 },
  achievementTitle: { fontSize: 16, color: '#333', fontWeight: 'bold', flex: 1 },
  lockedTitleText: { color: '#777', fontWeight: '500' },
  achievementProgress: { fontSize: 15, color: '#666', fontWeight: '600' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 200 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666', fontWeight: '500' },
  emptyBox: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 30, width: '90%', maxWidth: 420, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12, letterSpacing: 0.5 },
  modalDescription: { fontSize: 13, fontWeight: '500', color: '#666', lineHeight: 20, marginBottom: 20 },
  quickActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3498DB', borderRadius: 12, paddingVertical: 12, marginBottom: 16, justifyContent: 'center' },
  quickActionButtonText: { fontSize: 14, fontWeight: '700', color: '#FFF', marginLeft: 8, letterSpacing: 0.3 },
  manualInputSection: { marginBottom: 20 },
  manualInputLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8 },
  weightInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontWeight: '500', backgroundColor: '#F9F7F4' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalButton: { flex: 1, borderRadius: 12, paddingVertical: 12, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#F0F0F0' },
  cancelButtonText: { fontSize: 14, fontWeight: '700', color: '#666', letterSpacing: 0.3 },
  confirmButton: { backgroundColor: '#E67E22' },
  confirmButtonText: { fontSize: 14, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
});