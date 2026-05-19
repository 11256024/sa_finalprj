import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from "react-native-chart-kit";


export default function HistoryScreen() {
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
      // 💡 未來後端工程師只要把這裡換成實際的 API URL 即可
      // 例如: const response = await fetch(`https://your-api.com/api/v1/history?period=${period}`);
      // const json = await response.json();
     
      // --------------------------------------------------
      // 模擬後端從資料庫回傳的 Mock Data (到時候整段直接刪掉換成上面的 API)
      // 這裡模擬資料庫會隨著你切換「年、月、周、日」給予對應的數據
      await new Promise(resolve => setTimeout(resolve, 500)); // 模擬網路延遲 0.5 秒
     
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
      // --------------------------------------------------


      // 將從資料庫/模擬器撈到的資料，打進 React 的 State 驅動畫面更新
      setChartLabels(labels);
      setWeightData(weights);
      setBmiData(bmis);


    } catch (error) {
      console.error("撈取資料庫歷史紀錄失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };


  // 🎣 當頁面第一次載入，或者使用者切換「年/月/周/日」時，自動重新觸發資料庫查詢
  useEffect(() => {
    fetchHistoryData(selectedPeriod);
  }, [selectedPeriod]);


  // 💡 導覽列路由
  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') {
      router.push('/profile');
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');
    } else if (menuName === '歷史紀錄') {
      router.push('/history');
    } else if (menuName === '身體指數查詢') {
      router.push('/body-metrics');
    } else if (menuName === '查詢商品') {
      router.push('/products');
    } else if (menuName === '成就管理') {
      router.push('/achievements');
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, item === '歷史紀錄' && styles.activeMenu]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>


      {/* 主內容區 */}
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
                  // 當資料還在跟後端/資料庫拉取時，顯示轉圈圈，防止空資料噴錯
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
  header: { height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, zIndex: 10, ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } }) },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  memberCenterBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  memberCenterText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { minHeight: '100%', backgroundColor: '#F5F5DC' },
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

