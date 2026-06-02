import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-chart-kit";

const API_URL = 'http://127.0.0.1:8000';

export default function WeightPicScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const [selectedPeriod, setSelectedPeriod] = useState('周');

  // 🔄 狀態管理
  const [isLoading, setIsLoading] = useState(true);
  const [memberHeight, setMemberHeight] = useState<number | null>(null); 
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [weightData, setWeightData] = useState<number[]>([]);
  const [bmiData, setBmiData] = useState<number[]>([]);

  // 🕒 計算動態週日期
  const getDynamicWeekData = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const twDate = new Date(utc + 3600000 * 8);

    const hours = twDate.getHours();
    if (hours < 12) {
      twDate.setDate(twDate.getDate() - 1);
    }

    const currentDay = twDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(twDate);
    monday.setDate(twDate.getDate() + distanceToMonday);

    const labels: string[] = [];
    const fullDates: string[] = []; 

    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      
      const year = nextDay.getFullYear();
      const month = nextDay.getMonth() + 1;
      const date = nextDay.getDate();
      
      if (i === 6) {
        labels.push(`${month}/${date}\n(日期)`);
      } else {
        labels.push(`${month}/${date}`);
      }
      
      const queryMonth = month < 10 ? `0${month}` : `${month}`;
      const queryDate = date < 10 ? `0${date}` : `${date}`;
      fullDates.push(`${year}-${queryMonth}-${queryDate}`);
    }
    
    return { labels, fullDates };
  };

  // 🧮 依據體重與真實身高計算 BMI
  const calculateBmiDataset = (weights: number[], heightCm: number | null): number[] => {
    if (!heightCm || heightCm <= 0) return weights.map(() => 0);
    const heightMeters = heightCm / 100;
    return weights.map(w => {
      if (!w || w <= 0) return 0;
      const bmi = w / (heightMeters * heightMeters);
      return Math.round(bmi * 10) / 10;
    });
  };

  // 🌐 撈取每日紀錄檔儲存的真實體重
  const fetchHistoryData = async (period: string) => {
    setIsLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const savedCurrentUserId = await AsyncStorage.getItem('current_user_id');
      const savedMemberId = await AsyncStorage.getItem('member_id');

      const userId =
        currentUser?.id?.toString?.() ||
        savedCurrentUserId ||
        savedMemberId ||
        'guest';
      
      const finalUserId = /^\d+$/.test(userId) ? userId : 'guest';

      const savedHeightStr = await AsyncStorage.getItem(`${finalUserId}_user_height`);
      let currentHeight: number | null = null;
      if (savedHeightStr && savedHeightStr.trim() !== '') {
        const parsedHeight = parseFloat(savedHeightStr);
        if (!isNaN(parsedHeight) && parsedHeight > 0) currentHeight = parsedHeight;
      }
      setMemberHeight(currentHeight);

      const backendWeightByDate: Record<string, number> = {};
      if (/^\d+$/.test(finalUserId)) {
        try {
          const resp = await fetch(`${API_URL}/daily-logs/?member_id=${finalUserId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) {
              data.forEach((row: any) => {
                if (!row?.date) return;
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

      const getWeightForDate = async (dateStr: string): Promise<number> => {
        if (backendWeightByDate[dateStr]) return backendWeightByDate[dateStr];
        const recordDataStr = await AsyncStorage.getItem(`${finalUserId}_food_record_${dateStr}`);
        if (!recordDataStr) return 0;
        try {
          const parsedRecord = JSON.parse(recordDataStr);
          if (parsedRecord.hasDailyWeight && parsedRecord.weight) {
            const w = parseFloat(parsedRecord.weight);
            return !isNaN(w) && w > 0 ? w : 0;
          }
        } catch {}
        return 0;
      };

      let labels: string[] = [];
      let weights: number[] = [];

      if (period === '周') {
        const weekDataResult = getDynamicWeekData();
        labels = weekDataResult.labels;

        for (let i = 0; i < weekDataResult.fullDates.length; i++) {
          const targetDateStr = weekDataResult.fullDates[i];
          weights.push(await getWeightForDate(targetDateStr));
        }
        
      } else if (period === '月') {
        labels = ["W1", "W2", "W3", "W4(週別)"];
        const weekDataResult = getDynamicWeekData();
        let thisWeekSum = 0;
        let thisWeekCount = 0;

        for (let i = 0; i < weekDataResult.fullDates.length; i++) {
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

  useEffect(() => {
    fetchHistoryData(selectedPeriod);

    const timer = setInterval(() => {
      if (selectedPeriod === '周') {
        const { labels } = getDynamicWeekData();
        setChartLabels(labels);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [selectedPeriod]);

  const hasData = weightData.length > 0 && weightData.some(w => w > 0);
  const isDataEmpty = !hasData;

  const finalWeightData = isDataEmpty ? new Array(chartLabels.length).fill(0) : weightData;
  const finalBmiData = isDataEmpty ? new Array(chartLabels.length).fill(0) : bmiData;

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

                    const cleanLabel = chartLabels[index]?.replace('\n(日期)', '');
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