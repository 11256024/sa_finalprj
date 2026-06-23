// 檔案說明：歷史紀錄頁面：讀取最近飲食與體重資料，提供日期切換與歷史紀錄顯示。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';

// 📋 配合每日紀錄的資料結構進行定義
// 說明：FoodItem 定義這個頁面會使用的資料欄位與型別。
interface FoodItem {
  id: string;       
  name: string;     // 例如: "御飯糰/60克"
  calories: string; // 每日紀錄存的是字串
}

// 說明：DailyRecord 定義這個頁面會使用的資料欄位與型別。
interface DailyRecord {
  dateString: string;  
  displayDate: string; 
  dayOfWeek: string;   
  weight: string;      
  bmi: string;         
  mealBlocks: {
    早餐: FoodItem[];
    午餐: FoodItem[];
    晚餐: FoodItem[];
  };
}

// 說明：HistoryScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function HistoryScreen() {
  // 說明：宣告 router，集中處理這段畫面邏輯會用到的資料或方法。
  const router = useRouter();
  // 說明：宣告 pathname，集中處理這段畫面邏輯會用到的資料或方法。
  const pathname = usePathname();
  // 說明：宣告 isFocused，集中處理這段畫面邏輯會用到的資料或方法。
  const isFocused = useIsFocused(); 
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [thirtyDaysRecords, setThirtyDaysRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { recordUpdateVersion } = useDataContext();

  // 說明：宣告 getBaseBusinessDate，集中處理這段畫面邏輯會用到的資料或方法。
  const getBaseBusinessDate = () => {
    // 說明：宣告 now，集中處理這段畫面邏輯會用到的資料或方法。
    const now = new Date();
    // 說明：宣告 utc，集中處理這段畫面邏輯會用到的資料或方法。
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3600000 * 8); // 台灣時間
  };

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

  // 🔄 處理進入頁面刷新與午夜 12 點自動刷新
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    // 計算距離台灣時間今天晚上 12 點 (00:00) 還有多少毫秒，並設定定時器
    // 說明：宣告 setupMidnightRefresh，集中處理這段畫面邏輯會用到的資料或方法。
    const setupMidnightRefresh = () => {
      // 說明：宣告 now，集中處理這段畫面邏輯會用到的資料或方法。
      const now = new Date();
      // 說明：宣告 taiwanNow，集中處理這段畫面邏輯會用到的資料或方法。
      const taiwanNow = getBaseBusinessDate();
      // 說明：宣告 midnight，集中處理這段畫面邏輯會用到的資料或方法。
      const midnight = new Date(taiwanNow);
      
      // 設定目標時間為台灣時間明天的 00:00:00
      midnight.setDate(taiwanNow.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);

      // 說明：宣告 timeToMidnight，集中處理這段畫面邏輯會用到的資料或方法。
      const timeToMidnight = midnight.getTime() - now.getTime();
      console.log(`[自動刷新] 距離台灣午夜 12 點還有 ${(timeToMidnight / 1000 / 60).toFixed(1)} 分鐘`);

      // 設定倒數計時器
      midnightTimer = setTimeout(() => {
        console.log('[自動刷新] 已到晚上 12 點！正在自動重整 30 天滾動列表...');
        fetchDatabaseRecords();     // 刷新資料
        setupMidnightRefresh();     // 重新排程隔天的午夜刷新
      }, timeToMidnight);
    };

    if (isFocused) {
      fetchDatabaseRecords();       // 畫面向前台顯示時先刷一次
      setupMidnightRefresh();       // 啟動午夜倒數
    }

    // 離開頁面或 Component 卸載時，務必清除 Timer 避免耗電或重複執行
    return () => {
      if (midnightTimer) {
        clearTimeout(midnightTimer);
        console.log('[自動刷新] 已離開頁面，清除午夜定時器');
      }
    };
  }, [isFocused]);

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    if (isFocused && recordUpdateVersion > 0) {
      fetchDatabaseRecords();
    }
  }, [isFocused, recordUpdateVersion]);

  // 🌐 滾動式 30 天精準撈取與舊資料自動淘汰
  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const fetchDatabaseRecords = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // 優先從登入者抓 id，再退回舊 key，最後 guest
      // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
      const userStr = await AsyncStorage.getItem('user');
      // 說明：宣告 loggedInUser，集中處理這段畫面邏輯會用到的資料或方法。
      const loggedInUser = userStr ? JSON.parse(userStr) : null;
      // 說明：宣告 savedUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedUserId =
        loggedInUser?.id?.toString?.() ||
        (await AsyncStorage.getItem('current_user_id')) ||
        'guest';
      // 說明：宣告 globalHeight，集中處理這段畫面邏輯會用到的資料或方法。
      const globalHeight = await AsyncStorage.getItem(`${savedUserId}_user_height`) || await AsyncStorage.getItem('user_height_key') || await AsyncStorage.getItem('height') || '';

      // 說明：宣告 dayLabels，集中處理這段畫面邏輯會用到的資料或方法。
      const dayLabels = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      // 說明：宣告 baseDate，集中處理這段畫面邏輯會用到的資料或方法。
      const baseDate = getBaseBusinessDate();

      const foodKeys: string[] = [];
      const independentWeightKeys: string[] = []; 
      const dateMetaList: { dateStr: string; displayStr: string; dayOfWeekStr: string }[] = [];

      // 🔄 滾動機制：i = 0 是今天（最上面一筆），i = 29 是 30 天前
      for (let i = 0; i < 30; i++) {
        // 說明：宣告 d，集中處理這段畫面邏輯會用到的資料或方法。
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i); 

        // 說明：宣告 year，集中處理這段畫面邏輯會用到的資料或方法。
        const year = d.getFullYear();
        // 說明：宣告 month，集中處理這段畫面邏輯會用到的資料或方法。
        const month = String(d.getMonth() + 1).padStart(2, '0');
        // 說明：宣告 date，集中處理這段畫面邏輯會用到的資料或方法。
        const date = String(d.getDate()).padStart(2, '0');
        
        // 說明：宣告 dateStr，集中處理這段畫面邏輯會用到的資料或方法。
        const dateStr = getTaiwanDateString(d);       
        // 說明：宣告 displayStr，集中處理這段畫面邏輯會用到的資料或方法。
        const displayStr = `${month}/${date}`;            
        // 說明：宣告 dayOfWeekStr，集中處理這段畫面邏輯會用到的資料或方法。
        const dayOfWeekStr = dayLabels[d.getDay()];       

        foodKeys.push(`${savedUserId}_food_record_${dateStr}`);       
        independentWeightKeys.push(`${savedUserId}_weight_${dateStr}`); 

        dateMetaList.push({ dateStr, displayStr, dayOfWeekStr });
      }

      // 批量讀取本機資料
      // 說明：宣告 foodValuePairs，集中處理這段畫面邏輯會用到的資料或方法。
      const foodValuePairs = await AsyncStorage.multiGet(foodKeys);
      // 說明：宣告 weightValuePairs，集中處理這段畫面邏輯會用到的資料或方法。
      const weightValuePairs = await AsyncStorage.multiGet(independentWeightKeys);
      
      // 定義一個處理合併與渲染的內部函式
      // 說明：宣告 processAndSetRecords，集中處理這段畫面邏輯會用到的資料或方法。
      const processAndSetRecords = (backendData: Record<string, any> = {}) => {
        const records: DailyRecord[] = [];

        dateMetaList.forEach((meta, index) => {
          // 說明：宣告 rawFoodValue，集中處理這段畫面邏輯會用到的資料或方法。
          const rawFoodValue = foodValuePairs[index][1];
          // 說明：宣告 rawWeightValue，集中處理這段畫面邏輯會用到的資料或方法。
          const rawWeightValue = weightValuePairs[index][1]; 
          
          let dayData = rawFoodValue ? JSON.parse(rawFoodValue) : null;
          let currentMeals = dayData?.mealBlocks || { 早餐: [], 午餐: [], 晚餐: [] };

          let dayWeight = '';
          let dayBmi = '';

          if (dayData?.weight && dayData.weight.trim() !== '') {
            dayWeight = dayData.weight;
            dayBmi = dayData.bmi || '';
          } else if (rawWeightValue && rawWeightValue.trim() !== '') {
            dayWeight = rawWeightValue;
          }

          // 如果有後端資料，則進行補齊/覆蓋
          // 說明：宣告 fromBackend，集中處理這段畫面邏輯會用到的資料或方法。
          const fromBackend = backendData[meta.dateStr];
          if (fromBackend) {
            if (fromBackend.weight) dayWeight = fromBackend.weight;
            if (fromBackend.bmi) dayBmi = fromBackend.bmi;

            // 說明：宣告 backendMeals，集中處理這段畫面邏輯會用到的資料或方法。
            const backendMeals = fromBackend.meals || {};
            // 說明：宣告 localEmpty，集中處理這段畫面邏輯會用到的資料或方法。
            const localEmpty =
              currentMeals.早餐.length === 0 &&
              currentMeals.午餐.length === 0 &&
              currentMeals.晚餐.length === 0;
            // 說明：宣告 backendHasAny，集中處理這段畫面邏輯會用到的資料或方法。
            const backendHasAny =
              (backendMeals['早餐']?.length || 0) +
                (backendMeals['午餐']?.length || 0) +
                (backendMeals['晚餐']?.length || 0) >
              0;
            if (localEmpty && backendHasAny) {
              currentMeals = backendMeals;
            }
          }

          if (dayWeight && (!dayBmi || dayBmi === '')) {
            if (globalHeight) {
              // 說明：宣告 hMeter，集中處理這段畫面邏輯會用到的資料或方法。
              const hMeter = parseFloat(globalHeight) / 100;
              // 說明：宣告 wKg，集中處理這段畫面邏輯會用到的資料或方法。
              const wKg = parseFloat(dayWeight);
              if (hMeter > 0 && wKg > 0) {
                dayBmi = (wKg / (hMeter * hMeter)).toFixed(1);
              }
            }
          }

          records.push({
            dateString: meta.dateStr,
            displayDate: meta.displayStr,
            dayOfWeek: meta.dayOfWeekStr,
            weight: dayWeight, 
            bmi: dayBmi,       
            mealBlocks: {
              早餐: Array.isArray(currentMeals.早餐) ? currentMeals.早餐 : [],
              午餐: Array.isArray(currentMeals.午餐) ? currentMeals.午餐 : [],
              晚餐: Array.isArray(currentMeals.晚餐) ? currentMeals.晚餐 : [],
            }
          });
        });

        setThirtyDaysRecords(records);
        if (!selectedDate) setSelectedDate(records[0].dateString);
      };

      // 第一步：立即處理本機資料，關閉 Loading (達成「一秒內載入」)
      processAndSetRecords();
      setIsLoading(false);

      // 第二步：背景非同步去抓後端資料
      // 說明：宣告 isRealMember，集中處理這段畫面邏輯會用到的資料或方法。
      const isRealMember = /^\d+$/.test(savedUserId);
      if (isRealMember) {
        fetch(`${API_URL}/daily/summary/?member_id=${savedUserId}&days=30`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.success && Array.isArray(data.records)) {
              const backendRecordsByDate: Record<string, any> = {};
              data.records.forEach((r: any) => {
                backendRecordsByDate[r.date] = {
                  weight: r.weight || '',
                  bmi: r.bmi || '',
                  meals: r.meals || { 早餐: [], 午餐: [], 晚餐: [] },
                };
              });
              // 背景更新 UI
              processAndSetRecords(backendRecordsByDate);
            }
          })
          .catch(e => console.log('背景同步後端資料失敗:', e));
      }

      // 🧹 自動清理 30 天前的過期資料
      setTimeout(() => {
        const expiredKeys: string[] = [];
        for (let j = 30; j <= 50; j++) { 
          // 說明：宣告 expiredDate，集中處理這段畫面邏輯會用到的資料或方法。
          const expiredDate = new Date(baseDate.getTime());
          expiredDate.setDate(baseDate.getDate() - j);
          // 說明：宣告 expiredDateStr，集中處理這段畫面邏輯會用到的資料或方法。
          const expiredDateStr = getTaiwanDateString(expiredDate);
          expiredKeys.push(`${savedUserId}_food_record_${expiredDateStr}`, `${savedUserId}_weight_${expiredDateStr}`);
        }
        AsyncStorage.multiRemove(expiredKeys).catch(() => {});
      }, 1000);

    } catch (error: any) {
      console.error("撈取歷史紀錄失敗:", error);
      setErrorMessage(error.message || '無法讀取本機檔案。');
    } finally {
      setIsLoading(false);
    }
  };

  // 說明：宣告 currentRecord，集中處理這段畫面邏輯會用到的資料或方法。
  const currentRecord = thirtyDaysRecords.find(r => r.dateString === selectedDate);

  // 🧮 計算總熱量
  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateTotalCalories = () => {
    if (!currentRecord) return 0;
    let total = 0;
    Object.values(currentRecord.mealBlocks).forEach((foods) => {
      foods.forEach((item) => {
        // 說明：宣告 cal，集中處理這段畫面邏輯會用到的資料或方法。
        const cal = parseInt(item.calories, 10);
        if (!isNaN(cal)) total += cal;
      });
    });
    return total;
  };

  // 🧮 計算各別餐點小計
  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateMealSectionCalories = (foods: FoodItem[]) => {
    return foods.reduce((sum, item) => sum + (parseInt(item.calories, 10) || 0), 0);
  };

  // 🛠️ 品項欄位視覺美化拆解
  // 說明：宣告 renderFoodRows，集中處理這段畫面邏輯會用到的資料或方法。
  const renderFoodRows = (foods: FoodItem[]) => {
    return foods.map((food) => {
      let displayName = food.name;
      let displayUnit = '份';

      // 🛠️ 修復：使用 indexOf 僅分割第一個斜線，保留後方完整的「(X大卡/份)」
      // 說明：宣告 slashIndex，集中處理這段畫面邏輯會用到的資料或方法。
      const slashIndex = food.name.indexOf('/');
      if (slashIndex !== -1) {
        displayName = food.name.substring(0, slashIndex);
        displayUnit = food.name.substring(slashIndex + 1);
      }

      // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
      return (
        <View key={food.id} style={styles.tableRow}>
          <Text style={[styles.td, { flex: 1.2, fontWeight: '500' }]}>{displayName}</Text>
          <Text style={[styles.td, { flex: 1.8, textAlign: 'center', color: '#777', fontSize: 15 }]}>{displayUnit}</Text>
          <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#E28743', fontWeight: 'bold' }]}>{food.calories}</Text>
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#A3C1AD" />
            <Text style={styles.loadingText}>正在載入飲食紀錄...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>⚠️ 載入失敗</Text>
            <Text style={styles.errorSubText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchDatabaseRecords}>
              <Text style={styles.retryButtonText}>重新嘗試</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mainLayout}>
            
            {/* 左側：30 天日期切換 */}
            <View style={styles.dateSidebar}>
              <Text style={styles.sidebarTitle}>記錄查詢</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dateListContainer}>
                {thirtyDaysRecords.map((item) => {
                  // 說明：宣告 isSelected，集中處理這段畫面邏輯會用到的資料或方法。
                  const isSelected = item.dateString === selectedDate;
                  // 說明：宣告 hasFood，集中處理這段畫面邏輯會用到的資料或方法。
                  const hasFood = (item.mealBlocks.早餐.length + item.mealBlocks.午餐.length + item.mealBlocks.晚餐.length) > 0;
                  // 說明：宣告 hasWeight，集中處理這段畫面邏輯會用到的資料或方法。
                  const hasWeight = item.weight && item.weight.trim() !== '';
                  
                  return (
                    <TouchableOpacity 
                      key={item.dateString} 
                      style={[styles.dateCard, isSelected && styles.dateCardActive]}
                      onPress={() => setSelectedDate(item.dateString)}
                    >
                      <View style={styles.dateRow}>
                        <Text style={[styles.dateText, isSelected && styles.textActive]}>{item.displayDate}</Text>
                        <Text style={[styles.dayText, isSelected && styles.textActiveSub]}>{item.dayOfWeek}</Text>
                      </View>
                      <Text style={[styles.dateSubStatus, isSelected && styles.textActiveSub, (hasFood || hasWeight) && !isSelected && {color: '#5A7D56'}]}>
                        {hasFood && hasWeight ? '● 已記飲食/體重' : (hasFood ? '● 已記錄飲食' : (hasWeight ? '● 僅記錄體重' : '無紀錄'))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 右側：飲食歷史明細 */}
            <View style={styles.detailSection}>
              {currentRecord ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContainer}>
                  
                  {/* 當日健康總結卡片 */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                      <Text style={styles.summaryDateText}>{currentRecord.dateString} ({currentRecord.dayOfWeek}) 飲食總結</Text>
                      <View style={styles.weightBmiBadge}>
                        <Text style={styles.badgeText}>體重: {currentRecord.weight || '---'} kg</Text>
                        <Text style={styles.badgeText}>BMI: {currentRecord.bmi || '---'}</Text>
                      </View>
                    </View>
                    <View style={styles.totalCalorieRow}>
                      <Text style={styles.totalLabel}>當日攝取總熱量：</Text>
                      <Text style={styles.totalValue}>{calculateTotalCalories()} <Text style={styles.unitText}>kcal</Text></Text>
                    </View>
                  </View>

                  {/* 早餐 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>早餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{calculateMealSectionCalories(currentRecord.mealBlocks.早餐)} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 1.2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>單位 (含熱量明細)</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.mealBlocks.早餐.length > 0 ? (
                      renderFoodRows(currentRecord.mealBlocks.早餐)
                    ) : (
                      <Text style={styles.emptyMealText}>此時段無飲食存檔紀錄</Text>
                    )}
                  </View>

                  {/* 午餐 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>午餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{calculateMealSectionCalories(currentRecord.mealBlocks.午餐)} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 1.2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>單位 (含熱量明細)</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.mealBlocks.午餐.length > 0 ? (
                      renderFoodRows(currentRecord.mealBlocks.午餐)
                    ) : (
                      <Text style={styles.emptyMealText}>此時段無飲食存檔紀錄</Text>
                    )}
                  </View>

                  {/* 晚餐 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>晚餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{calculateMealSectionCalories(currentRecord.mealBlocks.晚餐)} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 1.2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>單位 (含熱量明細)</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.mealBlocks.晚餐.length > 0 ? (
                      renderFoodRows(currentRecord.mealBlocks.晚餐)
                    ) : (
                      <Text style={styles.emptyMealText}>此時段無飲食存檔紀錄</Text>
                    )}
                  </View>

                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>資料庫暫無該日紀錄存檔</Text>
                </View>
              )}
            </View>

          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  content: { flex: 1, backgroundColor: '#F5F5DC' }, 
  mainLayout: { flex: 1, flexDirection: 'row', maxWidth: 1200, width: '90%', alignSelf: 'center', marginVertical: 30 },
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 15, fontSize: 18, color: '#666', fontWeight: '500' },
  errorText: { fontSize: 24, fontWeight: 'bold', color: '#D9534F', marginBottom: 8 },
  errorSubText: { fontSize: 16, color: '#777', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#E67E22', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  retryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  dateSidebar: { width: 260, backgroundColor: 'white', borderRadius: 25, paddingVertical: 20, paddingHorizontal: 15, marginRight: 25, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  sidebarTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15, paddingLeft: 8, borderLeftWidth: 4, borderLeftColor: '#E67E22' },
  dateListContainer: { gap: 10 },
  dateCard: { backgroundColor: '#F9F9F9', borderRadius: 15, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#EEE' },
  dateCardActive: { backgroundColor: '#E67E22', borderColor: '#E67E22' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  dayText: { fontSize: 14, color: '#666' },
  dateSubStatus: { fontSize: 13, color: '#999', textAlign: 'right' },
  textActive: { color: 'white' },
  textActiveSub: { color: 'rgba(255,255,255,0.8)' },
  detailSection: { flex: 1, height: '100%' },
  detailContainer: { paddingBottom: 30, gap: 20 },
  summaryCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 12, marginBottom: 15 },
  summaryDateText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  weightBmiBadge: { flexDirection: 'row', gap: 12 },
  badgeText: { backgroundColor: '#F0F4EE', color: '#5A7D56', fontSize: 14, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  totalCalorieRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start' },
  totalLabel: { fontSize: 18, color: '#666', fontWeight: '500' },
  totalValue: { fontSize: 32, fontWeight: 'bold', color: '#E67E22' },
  unitText: { fontSize: 16, color: '#E67E22', fontWeight: '500' },
  mealSectionCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mealTitle: { fontSize: 22, fontWeight: 'bold', color: '#2C3E50' },
  mealCalorieSum: { fontSize: 16, fontWeight: '600', color: '#666', backgroundColor: '#F9F9F9', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#A3C1AD', paddingBottom: 8, marginBottom: 8 },
  th: { fontSize: 15, fontWeight: 'bold', color: '#888', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  td: { fontSize: 17, color: '#333' },
  emptyMealText: { fontSize: 16, color: '#BBB', textAlign: 'center', paddingVertical: 15, fontStyle: 'italic' },
  emptyState: { flex: 1, backgroundColor: 'white', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  emptyStateText: { fontSize: 18, color: '#999', fontWeight: '500' }
});