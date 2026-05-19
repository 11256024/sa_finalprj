import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// 📋 定義從資料庫撈取出來的單項食物與單日紀錄結構
interface FoodItem {
  id: string;     // 資料庫流水號或 UUID
  name: string;   // 食物品項名稱
  unit: string;   // 份量/單位
  calories: number; // 熱量 (大卡)
}

interface DailyRecord {
  dateString: string;  // 格式如: "2026-05-19"
  displayDate: string; // 顯示如: "05/19"
  dayOfWeek: string;   // 顯示如: "週二"
  weight: string;      // 當日體重
  bmi: string;         // 當日 BMI
  meals: {
    breakfast: FoodItem[];
    lunch: FoodItem[];
    dinner: FoodItem[];
  };
}

export default function HistoryScreen() {
  const router = useRouter();
  const pathname = usePathname(); // 🔄 動態偵測網址路徑，確保導覽列高亮底線 100% 精準
  
  // 🔄 狀態管理：控制目前選中的日期、30天資料庫數據以及載入狀態
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [thirtyDaysRecords, setThirtyDaysRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 👤 模擬會員頭像路徑 (與每日紀錄保持同步，未來可換成真實的後端圖片網址)
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // 定義橫幅選單的名稱與路由對照表
  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // 🌐 【核心對接功能】：從後端 API 撈取近 30 天資料庫真實飲食紀錄檔
  const fetchDatabaseRecords = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 💡 串接提示：請後端工程師提供此 API，並確認回傳結構符合 DailyRecord 陣列即可
      const response = await fetch('YOUR_BACKEND_API_URL/api/history/thirty-days');
      
      if (!response.ok) {
        throw new Error('伺服器回應錯誤，無法取得歷史紀錄。');
      }
      
      const data: DailyRecord[] = await response.json();
      setThirtyDaysRecords(data);
      
      // 預設自動選取最新的一天（通常是陣列的第一筆）
      if (data && data.length > 0) {
        setSelectedDate(data[0].dateString);
      }
    } catch (error: any) {
      console.error("撈取資料庫歷史紀錄失敗:", error);
      setErrorMessage(error.message || '無法連線至資料庫，請檢查網路連線。');
      
      // 💡 如果目前還沒有後端 API，可以暫時解開下方註解，用測試模擬數據來看畫面
      // setupMockData();
    } finally {
      setIsLoading(false);
    }
  };

  // 🧪 前端介面排版測試專用模擬數據 (API 未開好前可作測試，若不需要可直接刪除)
  const setupMockData = () => {
    const mockData: DailyRecord[] = [
      {
        dateString: "2026-05-19",
        displayDate: "05/19",
        dayOfWeek: "週二",
        weight: "68.5",
        bmi: "22.4",
        meals: {
          breakfast: [{ id: 'b1', name: '鮪魚蛋餅', unit: '1份', calories: 350 }],
          lunch: [{ id: 'l1', name: '雞胸肉健康便當', unit: '1個', calories: 580 }],
          dinner: [{ id: 'd1', name: '炙燒鮭魚沙拉', unit: '1盤', calories: 420 }]
        }
      },
      {
        dateString: "2026-05-18",
        displayDate: "05/18",
        dayOfWeek: "週一",
        weight: "68.8",
        bmi: "22.5",
        meals: {
          breakfast: [{ id: 'b2', name: '御飯糰', unit: '60克', calories: 180 }],
          lunch: [],
          dinner: [{ id: 'd2', name: '牛肉麵', unit: '1碗', calories: 750 }]
        }
      }
    ];
    setThirtyDaysRecords(mockData);
    setSelectedDate(mockData[0].dateString);
    setErrorMessage(null);
  };

  // 🎣 當頁面第一次載入時，主動向後端資料庫發出請求
  useEffect(() => {
    fetchDatabaseRecords();
  }, []);

  // 💡 抓取目前被使用者點選的日期紀錄物件
  const currentRecord = thirtyDaysRecords.find(r => r.dateString === selectedDate);

  // 🧮 動態加總計算當天「三餐總熱量」的邏輯
  const calculateTotalCalories = () => {
    if (!currentRecord) return 0;
    const bCal = currentRecord.meals?.breakfast?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0;
    const lCal = currentRecord.meals?.lunch?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0;
    const dCal = currentRecord.meals?.dinner?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0;
    return bCal + lCal + dCal;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {menuItems.map((item) => {
              // 精準比對路由路徑，決定是否高亮下劃線
              const isActive = pathname === item.path || (item.name === '歷史紀錄' && pathname.includes('history'));
              return (
                <TouchableOpacity key={item.name} onPress={() => router.push(item.path as any)} style={styles.menuButton}>
                  <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 👤 右上角：圓形大頭貼按鈕（與每日紀錄同步） */}
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

      {/* 主內容查詢中心 */}
      <View style={styles.content}>
        {isLoading ? (
          // ⏳ 資料庫讀取時的進度條提示
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#E28743" />
            <Text style={styles.loadingText}>正在連線資料庫，載入近 30 天飲食紀錄...</Text>
          </View>
        ) : errorMessage ? (
          // ❌ 連線失敗或 API 報錯時的異常提示
          <View style={styles.centerState}>
            <Text style={styles.errorText}>⚠️ 連線失敗</Text>
            <Text style={styles.errorSubText}>{errorMessage}</Text>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity style={styles.retryButton} onPress={fetchDatabaseRecords}>
                <Text style={styles.retryButtonText}>重新嘗試連線</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#A3C1AD' }]} onPress={setupMockData}>
                <Text style={styles.retryButtonText}>使用模擬數據測試</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mainLayout}>
            
            {/* 📅 左側面板：近 30 天日期切換列表 */}
            <View style={styles.dateSidebar}>
              <Text style={styles.sidebarTitle}>近 30 天記錄查詢</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dateListContainer}>
                {thirtyDaysRecords.map((item) => {
                  const isSelected = item.dateString === selectedDate;
                  const hasData = (item.meals?.breakfast?.length || 0) + (item.meals?.lunch?.length || 0) + (item.meals?.dinner?.length || 0) > 0;
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
                      <Text style={[styles.dateSubStatus, isSelected && styles.textActiveSub, hasData && !isSelected && {color: '#5A7D56'}]}>
                        {hasData ? '● 已記錄' : '無紀錄'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 🍽️ 右側面板：指定日期的早午晚餐歷史明細報表 */}
            <View style={styles.detailSection}>
              {currentRecord ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContainer}>
                  
                  {/* 📊 當日健康總結卡片 */}
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

                  {/* 🌅 早餐紀錄卡片 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>🌅 早餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{currentRecord.meals?.breakfast?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>單位</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.meals?.breakfast && currentRecord.meals.breakfast.length > 0 ? (
                      currentRecord.meals.breakfast.map((food) => (
                        <View key={food.id} style={styles.tableRow}>
                          <Text style={[styles.td, { flex: 2, fontWeight: '500' }]}>{food.name}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'center', color: '#777' }]}>{food.unit}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#E28743', fontWeight: 'bold' }]}>{food.calories}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyMealText}>此時段無飲食存檔紀錄</Text>
                    )}
                  </View>

                  {/* ☀️ 午餐紀錄卡片 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>☀️ 午餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{currentRecord.meals?.lunch?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>單位</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.meals?.lunch && currentRecord.meals.lunch.length > 0 ? (
                      currentRecord.meals.lunch.map((food) => (
                        <View key={food.id} style={styles.tableRow}>
                          <Text style={[styles.td, { flex: 2, fontWeight: '500' }]}>{food.name}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'center', color: '#777' }]}>{food.unit}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#E28743', fontWeight: 'bold' }]}>{food.calories}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyMealText}>此時段無飲食存檔紀錄</Text>
                    )}
                  </View>

                  {/* 🌙 晚餐紀錄卡片 */}
                  <View style={styles.mealSectionCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealTitle}>🌙 晚餐紀錄</Text>
                      <Text style={styles.mealCalorieSum}>
                        小計：{currentRecord.meals?.dinner?.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) || 0} kcal
                      </Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 2 }]}>品項</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>單位</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
                    </View>
                    {currentRecord.meals?.dinner && currentRecord.meals.dinner.length > 0 ? (
                      currentRecord.meals.dinner.map((food) => (
                        <View key={food.id} style={styles.tableRow}>
                          <Text style={[styles.td, { flex: 2, fontWeight: '500' }]}>{food.name}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'center', color: '#777' }]}>{food.unit}</Text>
                          <Text style={[styles.td, { flex: 1, textAlign: 'right', color: '#E28743', fontWeight: 'bold' }]}>{food.calories}</Text>
                        </View>
                      ))
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: {
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8, paddingBottom: 4 },
  
  // 🎯 白線底線高亮樣式
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  
  // 👤 大頭貼圓形樣式 (與 DailyRecord 完全同步)
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' },
  
  content: { flex: 1, backgroundColor: '#F6EFE5' },
  mainLayout: { flex: 1, flexDirection: 'row', maxWidth: 1200, width: '90%', alignSelf: 'center', marginVertical: 30 },
  
  // ⏳ 載入與錯誤畫面樣式
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 15, fontSize: 18, color: '#666', fontWeight: '500' },
  errorText: { fontSize: 24, fontWeight: 'bold', color: '#D9534F', marginBottom: 8 },
  errorSubText: { fontSize: 16, color: '#777', textAlign: 'center', marginBottom: 20 },
  retryButton: { backgroundColor: '#E28743', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  retryButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  // 📅 左側日期列表面板
  dateSidebar: { width: 260, backgroundColor: 'white', borderRadius: 25, paddingVertical: 20, paddingHorizontal: 15, marginRight: 25, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  sidebarTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15, paddingLeft: 8, borderLeftWidth: 4, borderLeftColor: '#E28743' },
  dateListContainer: { gap: 10 },
  dateCard: { backgroundColor: '#F9F9F9', borderRadius: 15, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#EEE' },
  dateCardActive: { backgroundColor: '#E28743', borderColor: '#E28743' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  dayText: { fontSize: 14, color: '#666' },
  dateSubStatus: { fontSize: 13, color: '#999', textAlign: 'right' },
  textActive: { color: 'white' },
  textActiveSub: { color: 'rgba(255,255,255,0.8)' },

  // 🍽️ 右側飲食詳細報表面板
  detailSection: { flex: 1, height: '100%' },
  detailContainer: { paddingBottom: 30, gap: 20 },
  
  // 數據總結頂部大卡片
  summaryCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 12, marginBottom: 15 },
  summaryDateText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  weightBmiBadge: { flexDirection: 'row', gap: 12 },
  badgeText: { backgroundColor: '#F0F4EE', color: '#5A7D56', fontSize: 14, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  totalCalorieRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start' },
  totalLabel: { fontSize: 18, color: '#666', fontWeight: '500' },
  totalValue: { fontSize: 32, fontWeight: 'bold', color: '#E28743' },
  unitText: { fontSize: 16, color: '#E28743', fontWeight: '500' },

  // 早午晚餐個別獨立卡片
  mealSectionCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mealTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  mealCalorieSum: { fontSize: 16, fontWeight: '600', color: '#666', backgroundColor: '#F9F9F9', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10 },
  
  // 三餐數據網格表格
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#E28743', paddingBottom: 8, marginBottom: 8 },
  th: { fontSize: 15, fontWeight: 'bold', color: '#888', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  td: { fontSize: 17, color: '#333' },
  emptyMealText: { fontSize: 16, color: '#BBB', textAlign: 'center', paddingVertical: 15, fontStyle: 'italic' },
  
  emptyState: { flex: 1, backgroundColor: 'white', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  emptyStateText: { fontSize: 18, color: '#999', fontWeight: '500' }
});