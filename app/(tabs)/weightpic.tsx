import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-chart-kit";

export default function WeightPicScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const [selectedPeriod, setSelectedPeriod] = useState('周');

  // 🔄 狀態管理：加載狀態與圖表數據
  const [isLoading, setIsLoading] = useState(true);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [weightData, setWeightData] = useState<number[]>([]);
  const [bmiData, setBmiData] = useState<number[]>([]);

  // 🌐 【核心功能】：從後端 API 撈取動態數據
  const fetchHistoryData = async (period: string) => {
    setIsLoading(true);
    try {
      // 模擬網路延遲 0.5 秒
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let labels: string[] = [];
      let weights: number[] = [];
      let bmis: number[] = [];

      if (period === '周') {
        labels = ["4/13", "4/14", "4/15", "4/16", "4/17", "4/18", "4/19"];
        weights = [65.6, 65.4, 65.0, 66.2, 65.8, 65.2, 65.7];
        bmis = [23.5, 23.4, 23.2, 23.8, 23.6, 23.3, 23.5];
      } else if (period === '月') {
        labels = ["W1", "W2", "W3", "W4"];
        weights = [66.5, 66.0, 65.8, 65.7];
        bmis = [23.8, 23.6, 23.5, 23.5];
      } else if (period === '年') {
        labels = ["1-3月", "4-6月", "7-9月", "10-12月"];
        weights = [68.0, 66.5, 65.2, 64.8];
        bmis = [24.3, 23.8, 23.3, 23.2];
      } else { // 日
        labels = ["08:00", "12:00", "20:00"];
        weights = [65.2, 65.5, 65.7];
        bmis = [23.3, 23.4, 23.5];
      }

      setChartLabels(labels);
      setWeightData(weights);
      setBmiData(bmis);

    } catch (error) {
      console.error("撈取資料庫歷史紀錄失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 🎣 當選擇週期改變時自動重新查詢
  useEffect(() => {
    fetchHistoryData(selectedPeriod);
  }, [selectedPeriod]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 主內容區：頂部完全淨空，直接呈現卡片內容 */}
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainWrapper}>
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <TouchableOpacity style={styles.arrowBtn}><Text style={styles.arrowText}>〈</Text></TouchableOpacity>
              <Text style={styles.chartMainTitle}>本{selectedPeriod}體重及BMI紀錄</Text>
              <TouchableOpacity style={styles.arrowBtn}><Text style={styles.arrowText}>〉</Text></TouchableOpacity>
            </View>

            <View style={styles.chartBodyContainer}>
              {/* 左側圖表或加載圈圈 */}
              <View style={styles.chartLeftBlock}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4682B4" />
                    <Text style={styles.loadingText}>讀取資料庫中...</Text>
                  </View>
                ) : chartLabels.length > 0 ? (
                  <LineChart
                    data={{
                      labels: chartLabels,
                      datasets: [
                        { data: weightData, color: (opacity = 1) => `rgba(70, 130, 180, ${opacity})`, strokeWidth: 3 },
                        { data: bmiData, color: (opacity = 1) => `rgba(243, 176, 126, ${opacity})`, strokeWidth: 3 }
                      ],
                    }}
                    width={Platform.OS === 'web' ? screenWidth * 0.45 : screenWidth * 0.75}
                    height={320}
                    chartConfig={{
                      backgroundColor: "#ffffff", backgroundGradientFrom: "#ffffff", backgroundGradientTo: "#ffffff", decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(150, 150, 150, ${opacity})`, labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                      style: { borderRadius: 16 }, propsForDots: { r: "4", strokeWidth: "1" }, fillShadowGradientFrom: "transparent", fillShadowGradientTo: "transparent",
                    }}
                    bezier withInnerLines={true} withOuterLines={true} style={styles.chartStyle}
                  />
                ) : (
                  <Text style={styles.loadingText}>暫無歷史數據</Text>
                )}

                {/* 自訂圖例 */}
                <View style={styles.customLegend}>
                  <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: '#4682B4' }]} /><View style={[styles.legendDot, { backgroundColor: '#4682B4' }]} /><Text style={styles.legendText}>體重</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: '#F3B07E' }]} /><View style={[styles.legendDot, { backgroundColor: '#F3B07E' }]} /><Text style={styles.legendText}>BMI</Text></View>
                </View>
              </View>

              {/* 右側時間選單（年、月、周、日） */}
              <View style={styles.sideDateMenu}>
                {['年', '月', '周', '日'].map((item) => (
                  <TouchableOpacity key={item} style={styles.dateUnitBtn} onPress={() => setSelectedPeriod(item)}>
                    <Text style={[styles.dateUnitText, item === selectedPeriod && styles.dateUnitTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  
  // 背景色保持專案米色基調一致
  scrollContent: { minHeight: '100%', backgroundColor: '#F6EFE5' },
  mainWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  chartCard: { backgroundColor: 'white', width: '65%', minWidth: 720, borderRadius: 40, paddingVertical: 40, paddingHorizontal: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  arrowBtn: { paddingHorizontal: 15, paddingVertical: 5 },
  arrowText: { fontSize: 26, fontWeight: '300', color: '#333' },
  chartMainTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  chartBodyContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartLeftBlock: { flex: 1, alignItems: 'center', paddingRight: 10 },
  chartStyle: { marginVertical: 10 },
  loadingContainer: { height: 320, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  customLegend: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, position: 'relative' },
  legendLine: { width: 24, height: 2, marginRight: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', left: 8 },
  legendText: { fontSize: 15, color: '#555', fontWeight: '500', marginLeft: 5 },
  sideDateMenu: { width: 60, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  dateUnitBtn: { paddingVertical: 14, width: '100%', alignItems: 'center' },
  dateUnitText: { fontSize: 22, color: '#B0B0B0', fontWeight: '500' },
  dateUnitTextActive: { color: '#111111', fontWeight: 'bold', fontSize: 24 }
});