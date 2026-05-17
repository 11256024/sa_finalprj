import { useRouter } from 'expo-router';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BodyMetricsScreen() {
  const router = useRouter();

  const handleMenuPress = (menuName: string) => {
    if (menuName === '身體指數查詢') {
      router.push('/body-metrics');
    } else if (menuName === '會員中心') {
      router.push('/profile');
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');
    } else {
      if (Platform.OS === 'web') window.alert(`即將前往：${menuName}`);
      else Alert.alert("導航", `即將前往：${menuName}`);
    }
  };

  // 💡 只有 5 種活動量卡片，已移除 BMI 按鈕卡片
  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', formula: 'BMR x 1.2', value: 'BMR x 1.2'},
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', formula: 'BMR x 1.375', value: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', formula: 'BMR x 1.55', value:  'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', formula: 'BMR x 1.72', value: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', formula: 'BMR x 1.9', value: 'BMR x 1.9' },
  ];

  // 💡 調整字體間距，對齊第一張圖的文字排版
  const bmrLabels = [
    { key: 'gender', display: '生 理 性 別' },
    { key: 'age',    display: '年     齡' },
    { key: 'height', display: '身     高' },
    { key: 'weight', display: '體     重' },
    { key: 'bmi',    display: 'B  M  I' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, item === '身體指數查詢' && styles.activeMenu]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>

      {/* 身體指數主內容區 */}
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.metricsCard}>
            
            {/* 左側：BMR 卡片 */}
            <View style={styles.bmrCard}>
              <Text style={styles.bmrMainTitle}>基礎代謝率BMR</Text>
              
              <View style={styles.bmrList}>
                {bmrLabels.map((item) => (
                  <View key={item.key} style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>{item.display}</Text>
                    <Text style={styles.bmrValue}>{item.key === 'bmi' ? 'B M I' : item.display.replace(/\s+/g, '')}</Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>計算結果：</Text>
                <Text style={styles.resultValue}>BMR</Text>
              </View>
            </View>

            {/* 右側：TDEE 卡片組 */}
            <View style={styles.tdeeSection}>
              
              {/* TDEE 固定標題卡片 */}
              <View style={styles.tdeeTitleBox}>
                <View style={styles.tdeeMainHeader}>
                  <Text style={styles.tdeeTitle}>TDEE</Text>
                  <Text style={styles.tdeeSubTitle}>每日總消耗</Text>
                </View>
                <Text style={styles.tdeeDesc}>人體一整天下來消耗的總熱量</Text>
              </View>

              {/* 動態渲染右側的 5 個活動量卡片 */}
              {tdeeItems.map((item) => (
                <View key={item.id} style={styles.tdeeItemBox}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activitySub}>{item.sub}</Text>
                  <Text style={styles.formulaText}>
                    {item.formula} = <Text style={styles.orangeHighlight}>{item.value}</Text>
                  </Text>
                </View>
              ))}

            </View>

          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.7 },
  activeMenu: { opacity: 1, fontWeight: 'bold' },
  memberCenterBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  memberCenterText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  // 主內容與滾動容器
  content: { flex: 1, backgroundColor: '#F6EFE5' },
  scrollContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  metricsCard: { width: '85%', maxWidth: 1000, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },
  
  // 左側 BMR 卡片細節微調：限制最大寬度，避免網頁端被無限拉寬
  bmrCard: { backgroundColor: 'white', flex: 1, maxWidth: 460, borderRadius: 35, paddingHorizontal: 45, paddingVertical: 50, marginRight: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, position: 'sticky', top: 40 },
  bmrMainTitle: { fontSize: 32, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 45, letterSpacing: 0.5 },
  bmrList: { marginBottom: 35 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#FDFDFD' },
  bmrLabel: { fontSize: 20, fontWeight: '600', color: '#333', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, // 用等寬概念確保中文字對齊
  bmrValue: { fontSize: 20, color: '#BBB', fontWeight: '500' },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 55 },
  resultLabel: { fontSize: 26, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 36, color: '#BBB', fontWeight: 'bold', marginLeft: 15 },

  // 右側 TDEE 區塊
  tdeeSection: { flex: 1, marginLeft: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' },
  
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 30, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#000', marginRight: 10, letterSpacing: 1 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  
  // 右側卡片元件
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#000', textAlign: 'center' },
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});