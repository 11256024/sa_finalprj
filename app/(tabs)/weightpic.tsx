// 檔案說明：體重紀錄圖表頁面：讀取每日體重資料並用圖表呈現變化。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-chart-kit";

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';

// 說明：WeightPicScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function WeightPicScreen() {
  // 說明：宣告 router，集中處理這段畫面邏輯會用到的資料或方法。
  const router = useRouter();
  // 說明：宣告 screenWidth，集中處理這段畫面邏輯會用到的資料或方法。
  const screenWidth = Dimensions.get("window").width;
  const [selectedPeriod, setSelectedPeriod] = useState('周');

  // 🔄 狀態管理
  const [isLoading, setIsLoading] = useState(true);
  const [memberHeight, setMemberHeight] = useState<number | null>(null); 
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [weightData, setWeightData] = useState<number[]>([]);
  const [bmiData, setBmiData] = useState<number[]>([]);

  // 🕒 計算動態週日期
  // 說明：宣告 getDynamicWeekData，集中處理這段畫面邏輯會用到的資料或方法。
  const getDynamicWeekData = () => {
    // 說明：宣告 now，集中處理這段畫面邏輯會用到的資料或方法。
    const now = new Date();
    // 說明：宣告 utc，集中處理這段畫面邏輯會用到的資料或方法。
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    // 說明：宣告 twDate，集中處理這段畫面邏輯會用到的資料或方法。
    const twDate = new Date(utc + 3600000 * 8);

    // 說明：宣告 hours，集中處理這段畫面邏輯會用到的資料或方法。
    const hours = twDate.getHours();
    if (hours < 12) {
      twDate.setDate(twDate.getDate() - 1);
    }

    // 說明：宣告 currentDay，集中處理這段畫面邏輯會用到的資料或方法。
    const currentDay = twDate.getDay();
    // 說明：宣告 distanceToMonday，集中處理這段畫面邏輯會用到的資料或方法。
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    // 說明：宣告 monday，集中處理這段畫面邏輯會用到的資料或方法。
    const monday = new Date(twDate);
    monday.setDate(twDate.getDate() + distanceToMonday);

    const labels: string[] = [];
    const fullDates: string[] = []; 

    for (let i = 0; i < 7; i++) {
      // 說明：宣告 nextDay，集中處理這段畫面邏輯會用到的資料或方法。
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      
      // 說明：宣告 year，集中處理這段畫面邏輯會用到的資料或方法。
      const year = nextDay.getFullYear();
      // 說明：宣告 month，集中處理這段畫面邏輯會用到的資料或方法。
      const month = nextDay.getMonth() + 1;
      // 說明：宣告 date，集中處理這段畫面邏輯會用到的資料或方法。
      const date = nextDay.getDate();
      
      if (i === 6) {
        labels.push(`${month}/${date}\n(日期)`);
      } else {
        labels.push(`${month}/${date}`);
      }
      
      // 說明：宣告 queryMonth，集中處理這段畫面邏輯會用到的資料或方法。
      const queryMonth = month < 10 ? `0${month}` : `${month}`;
      // 說明：宣告 queryDate，集中處理這段畫面邏輯會用到的資料或方法。
      const queryDate = date < 10 ? `0${date}` : `${date}`;
      fullDates.push(`${year}-${queryMonth}-${queryDate}`);
    }
    
    return { labels, fullDates };
  };

  // 🧮 依據體重與真實身高計算 BMI
  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateBmiDataset = (weights: number[], heightCm: number | null): number[] => {
    if (!heightCm || heightCm <= 0) return weights.map(() => 0);
    // 說明：宣告 heightMeters，集中處理這段畫面邏輯會用到的資料或方法。
    const heightMeters = heightCm / 100;
    return weights.map(w => {
      if (!w || w <= 0) return 0;
      // 說明：宣告 bmi，集中處理這段畫面邏輯會用到的資料或方法。
      const bmi = w / (heightMeters * heightMeters);
      return Math.round(bmi * 10) / 10;
    });
  };

  // 🌐 撈取每日紀錄檔儲存的真實體重
  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const fetchHistoryData = async (period: string) => {
    setIsLoading(true);
    try {
      // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
      const userStr = await AsyncStorage.getItem('user');
      // 說明：宣告 currentUser，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUser = userStr ? JSON.parse(userStr) : null;
      // 說明：宣告 savedCurrentUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedCurrentUserId = await AsyncStorage.getItem('current_user_id');
      // 說明：宣告 savedMemberId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedMemberId = await AsyncStorage.getItem('member_id');

      // 說明：宣告 userId，集中處理這段畫面邏輯會用到的資料或方法。
      const userId =
        currentUser?.id?.toString?.() ||
        savedCurrentUserId ||
        savedMemberId ||
        'guest';
      
      // 說明：宣告 finalUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const finalUserId = /^\d+$/.test(userId) ? userId : 'guest';

      // 說明：宣告 savedHeightStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedHeightStr = await AsyncStorage.getItem(`${finalUserId}_user_height`);
      let currentHeight: number | null = null;
      if (savedHeightStr && savedHeightStr.trim() !== '') {
        // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
        const parsedHeight = parseFloat(savedHeightStr);
        if (!isNaN(parsedHeight) && parsedHeight > 0) currentHeight = parsedHeight;
      }
      setMemberHeight(currentHeight);

      const backendWeightByDate: Record<string, number> = {};
      if (/^\d+$/.test(finalUserId)) {
        try {
          // 說明：宣告 resp，集中處理這段畫面邏輯會用到的資料或方法。
          const resp = await fetch(`${API_URL}/daily-logs/?member_id=${finalUserId}`);
          if (resp.ok) {
            // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
            const data = await resp.json();
            if (Array.isArray(data)) {
              data.forEach((row: any) => {
                if (!row?.date) return;
                // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
                const w = parseFloat(row.weight);
                if (!isNaN(w) && w > 0) {
                  backendWeightByDate[row.date] = w;
                }
              });
            }
          }
        } catch (e) {
          console.log('weightpic 從後端取體重失敗，沿用本機', e);
        }
      }

      // 說明：宣告 getWeightForDate，集中處理這段畫面邏輯會用到的資料或方法。
      const getWeightForDate = async (dateStr: string): Promise<number> => {
        if (backendWeightByDate[dateStr]) return backendWeightByDate[dateStr];
        // 說明：宣告 recordDataStr，集中處理這段畫面邏輯會用到的資料或方法。
        const recordDataStr = await AsyncStorage.getItem(`${finalUserId}_food_record_${dateStr}`);
        if (!recordDataStr) return 0;
        try {
          // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
          const parsedRecord = JSON.parse(recordDataStr);
          if (parsedRecord.hasDailyWeight && parsedRecord.weight) {
            // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
            const w = parseFloat(parsedRecord.weight);
            return !isNaN(w) && w > 0 ? w : 0;
          }
        } catch {}
        return 0;
      };

      let labels: string[] = [];
      let weights: number[] = [];

      if (period === '周') {
        // 說明：宣告 weekDataResult，集中處理這段畫面邏輯會用到的資料或方法。
        const weekDataResult = getDynamicWeekData();
        labels = weekDataResult.labels;

        for (let i = 0; i < weekDataResult.fullDates.length; i++) {
          // 說明：宣告 targetDateStr，集中處理這段畫面邏輯會用到的資料或方法。
          const targetDateStr = weekDataResult.fullDates[i];
          weights.push(await getWeightForDate(targetDateStr));
        }
        
      } else if (period === '月') {
        labels = ["W1", "W2", "W3", "W4(週別)"];
        // 說明：宣告 weekDataResult，集中處理這段畫面邏輯會用到的資料或方法。
        const weekDataResult = getDynamicWeekData();
        let thisWeekSum = 0;
        let thisWeekCount = 0;

        for (let i = 0; i < weekDataResult.fullDates.length; i++) {
          // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
          const w = await getWeightForDate(weekDataResult.fullDates[i]);
          if (w > 0) {
            thisWeekSum += w;
            thisWeekCount += 1;
          }
        }
        weights = [0, 0, thisWeekCount > 0 ? Math.round((thisWeekSum / thisWeekCount) * 10) / 10 : 0, 0];

      } else if (period === '年') {
        labels = ["1-3月", "4-6月", "7-9月", "10-12月(季度)"];
        weights = [0, 0, 0, 0];
      }

      // 說明：宣告 computedBmis，集中處理這段畫面邏輯會用到的資料或方法。
      const computedBmis = weights.length > 0 ? calculateBmiDataset(weights, currentHeight) : [];

      setChartLabels(labels);
      setWeightData(weights);
      setBmiData(computedBmis);

    } catch (error) {
      console.error("對接飲食紀錄檔並讀取數據失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    fetchHistoryData(selectedPeriod);

    // 說明：宣告 timer，集中處理這段畫面邏輯會用到的資料或方法。
    const timer = setInterval(() => {
      if (selectedPeriod === '周') {
        const { labels } = getDynamicWeekData();
        setChartLabels(labels);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [selectedPeriod]);

  // 說明：宣告 hasData，集中處理這段畫面邏輯會用到的資料或方法。
  const hasData = weightData.length > 0 && weightData.some(w => w > 0);
  // 說明：宣告 isDataEmpty，集中處理這段畫面邏輯會用到的資料或方法。
  const isDataEmpty = !hasData;

  // 說明：宣告 finalWeightData，集中處理這段畫面邏輯會用到的資料或方法。
  const finalWeightData = isDataEmpty ? new Array(chartLabels.length).fill(0) : weightData;
  // 說明：宣告 finalBmiData，集中處理這段畫面邏輯會用到的資料或方法。
  const finalBmiData = isDataEmpty ? new Array(chartLabels.length).fill(0) : bmiData;

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainWrapper}>
          <View style={styles.chartCard}>
            
            {/* 標題區 */}
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartMainTitle}>“本{selectedPeriod}體重及BMI紀錄”</Text>
            </View>

            <View style={styles.chartBodyContainer}>
              {/* 左側圖表區塊 */}
              <View style={styles.chartLeftBlock}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4682B4" />
                    <Text style={styles.loadingText}>讀取資料庫中...</Text>
                  </View>
                ) : chartLabels.length > 0 ? (
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <LineChart
                      data={{
                        labels: chartLabels,
                        datasets: [
                          { 
                            data: finalWeightData, 
                            color: (opacity = 1) => isDataEmpty ? `rgba(0,0,0,0)` : `rgba(70, 130, 180, ${opacity})`, 
                            strokeWidth: isDataEmpty ? 0 : 3 
                          },
                          { 
                            data: finalBmiData, 
                            color: (opacity = 1) => isDataEmpty ? `rgba(0,0,0,0)` : `rgba(243, 176, 126, ${opacity})`, 
                            strokeWidth: isDataEmpty ? 0 : 3 
                          },
                          {
                            data: [30, 200],
                            withDots: false,
                            color: () => 'transparent',
                            strokeWidth: 0,
                          }
                        ],
                      }}
                      width={Platform.OS === 'web' ? screenWidth * 0.45 : screenWidth * 0.75}
                      height={320}
                      fromZero={false}
                      yAxisSuffix=""
                      chartConfig={{
                        backgroundColor: "#ffffff", 
                        backgroundGradientFrom: "#ffffff", 
                        backgroundGradientTo: "#ffffff", 
                        decimalPlaces: 0, 
                        color: (opacity = 1) => `rgba(210, 210, 210, ${opacity})`, 
                        labelColor: (opacity = 1) => `rgba(120, 120, 120, ${opacity})`, 
                        style: { borderRadius: 16 }, 
                        propsForDots: { 
                          r: isDataEmpty ? "0" : "5", 
                          strokeWidth: "1" 
                        }, 
                        fillShadowGradientFrom: "transparent", 
                        fillShadowGradientTo: "transparent",
                        fillShadowGradientFromOpacity: 0,
                        fillShadowGradientToOpacity: 0,
                        formatYLabel: (yValue) => {
                          // 說明：宣告 val，集中處理這段畫面邏輯會用到的資料或方法。
                          const val = parseFloat(yValue);
                          if (val <= 31) return "0";
                          if (val > 31 && val < 80) return "50";
                          if (val >= 80 && val < 130) return "100";
                          if (val >= 130 && val < 170) return "150";
                          return "200";
                        }
                      }}
                      getDotProps={(value) => ({
                        r: value === 0 ? "0" : "5",
                        strokeWidth: value === 0 ? "0" : "1.5"
                      })}
                      bezier={!isDataEmpty} 
                      withInnerLines={true} 
                      withOuterLines={true} 
                      style={styles.chartStyle}
                    />

                    {/* 空歷史提示 */}
                    {isDataEmpty && (
                      <Text style={styles.noDataHintText}>
                        暫無{selectedPeriod}歷史紀錄 {!memberHeight ? '(請至會員中心填寫身高以啟用BMI)' : ''}
                      </Text>
                    )}
                  </View>
                ) : null}

                {/* 下方圖例 */}
                <View style={styles.customLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: '#4682B4' }]} />
                    <View style={[styles.legendDot, { backgroundColor: '#4682B4' }]} />
                    <Text style={styles.legendText}>體重 (kg)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendLine, { backgroundColor: '#F3B07E' }]} />
                    <View style={[styles.legendDot, { backgroundColor: '#F3B07E' }]} />
                    <Text style={styles.legendText}>BMI</Text>
                  </View>
                </View>
              </View>

              {/* 右側時間選單 */}
              <View style={styles.sideDateMenu}>
                {['年', '月', '周'].map((item) => (
                  <TouchableOpacity 
                    key={item} 
                    style={styles.dateUnitBtn} 
                    onPress={() => setSelectedPeriod(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateUnitText, item === selectedPeriod && styles.dateUnitTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ✨ 新增：網頁專屬【數據明細觀測面板】 */}
            {!isDataEmpty && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>📊 數據明細摘要</Text>
                <View style={styles.detailsGrid}>
                  {weightData.map((weight, index) => {
                    // 如果這天沒有數據 (等於 0)，就優雅地跳過不顯示
                    if (weight <= 0) return null;

                    // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
                    const cleanLabel = chartLabels[index]?.replace('\n(日期)', '');
                    // 說明：宣告 currentBmi，集中處理這段畫面邏輯會用到的資料或方法。
                    const currentBmi = bmiData[index];

                    return (
                      <View key={index} style={styles.detailCard}>
                        <Text style={styles.detailDateText}>{cleanLabel}</Text>
                        <View style={styles.detailValueRow}>
                          <Text style={styles.detailWeightVal}>{weight} <Text style={{ fontSize: 11, color: '#888' }}>kg</Text></Text>
                          <Text style={styles.detailBmiVal}>BMI: {currentBmi > 0 ? currentBmi : '--'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  scrollContent: { minHeight: '100%', backgroundColor: '#F6EFE5' },
  mainWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  chartCard: { 
    backgroundColor: 'white', 
    width: '65%', 
    minWidth: 720, 
    borderRadius: 40, 
    paddingVertical: 40, 
    paddingHorizontal: 30, 
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12,
    willChange: 'transform'
  },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  chartMainTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  chartBodyContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartLeftBlock: { flex: 1, alignItems: 'center', paddingRight: 10 },
  chartStyle: { marginVertical: 10 },
  loadingContainer: { height: 320, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666', fontWeight: '500' },
  noDataHintText: { position: 'absolute', bottom: 60, fontSize: 15, color: '#A0A0A0', fontWeight: '500', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 15, paddingVertical: 4, borderRadius: 20 },
  customLegend: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, position: 'relative' },
  legendLine: { width: 24, height: 2, marginRight: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', left: 8 },
  legendText: { fontSize: 15, color: '#555', fontWeight: '500', marginLeft: 5 },
  sideDateMenu: { width: 60, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  dateUnitBtn: { paddingVertical: 16, width: '100%', alignItems: 'center' },
  dateUnitText: { fontSize: 22, color: '#B0B0B0', fontWeight: '500' },
  dateUnitTextActive: { color: '#111111', fontWeight: 'bold', fontSize: 24 },
  
  // ✨ 明細觀測面板專屬樣式
  detailsContainer: {
    marginTop: 35,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 25,
    width: '90%',
    alignSelf: 'center',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 15,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    minWidth: 110,
    alignItems: 'center',
  },
  detailDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailValueRow: {
    alignItems: 'center',
  },
  detailWeightVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4682B4',
  },
  detailBmiVal: {
    fontSize: 12,
    color: '#E69153',
    fontWeight: '500',
    marginTop: 2,
  },
});