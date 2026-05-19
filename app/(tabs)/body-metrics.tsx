import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BodyMetricsScreen() {
  const router = useRouter();

  // 1. 狀態控制：儲存當前的輸入數值與計算結果
  const [metricsData, setMetricsData] = useState({
    gender: '',
    age: '',
    height: '',
    weight: '',
    bmi: '---',
    bmrValue: 0,
    isCalculated: false // 控制 BMR 總結與右側 TDEE 是否亮起
  });

  // 2. 下拉選單資料源 (Web 端專用)
  const ageOptions = Array.from({ length: 91 }, (_, i) => (i + 10).toString()); // 10 - 100 歲
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString()); // 100 - 250 cm
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  // 30 - 200 kg
  const genderOptions = ['男', '女'];

  // 💡 核心優化：當身高或體重改變時，自動即時計算 BMI
  useEffect(() => {
    const weight = parseFloat(metricsData.weight);
    const height = parseFloat(metricsData.height);

    if (weight > 0 && height > 0) {
      const heightInMeters = height / 100;
      const calculatedBmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
      setMetricsData(prev => ({ ...prev, bmi: calculatedBmi }));
    } else {
      setMetricsData(prev => ({ ...prev, bmi: '---' }));
    }
  }, [metricsData.height, metricsData.weight]);

  // 🎯 功能一：同步 Profile 的 LocalStorage 資料（已移除 Alert 提示框）
  const handleSyncProfile = () => {
    try {
      let savedProfile = null;
      if (Platform.OS === 'web') {
        const localData = localStorage.getItem('user_profile');
        if (localData) savedProfile = JSON.parse(localData);
      }

      // 防呆：檢查是否有填寫過資料
      if (!savedProfile || !savedProfile.height || !savedProfile.weight || !savedProfile.birthday) {
        if (Platform.OS === 'web') {
          window.alert('同步失敗：偵測到您的會員中心基本資料尚未完整填寫！');
        } else {
          alert('偵測到您的會員中心基本資料尚未填寫完成！');
        }
        return;
      }

      // 解析生日算年齡
      const birthDate = new Date(savedProfile.birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // 直接帶入並觸發完整計算
      runCalculation(savedProfile.gender, age.toString(), savedProfile.height, savedProfile.weight);
    } catch (error) {
      console.error("同步會員資料時發生錯誤：", error);
    }
  };

  // 🎯 功能二：手動點擊「開始計算指數」（產出 BMR 與 TDEE）
  const handleManualCalculate = () => {
    if (!metricsData.gender || !metricsData.age || !metricsData.height || !metricsData.weight) {
      if (Platform.OS === 'web') {
        window.alert('請填寫完整的性別、年齡、身高、體重資訊後再進行計算！');
      } else {
        alert('請填寫完整的數據資訊！');
      }
      return;
    }
    runCalculation(metricsData.gender, metricsData.age, metricsData.height, metricsData.weight);
  };

  // 提取出的核心 BMR 計算邏輯
  const runCalculation = (gender: string, ageStr: string, heightStr: string, weightStr: string) => {
    const weight = parseFloat(weightStr);
    const height = parseFloat(heightStr);
    const age = parseInt(ageStr);

    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);

    // Mifflin-St Jeor 公式計算 BMR
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (gender === '男') bmr += 5;
    else bmr -= 161;
    const finalBmr = Math.round(bmr);

    setMetricsData({
      gender,
      age: age.toString(),
      height: height.toString(),
      weight: weight.toString(),
      bmi,
      bmrValue: finalBmr,
      isCalculated: true
    });
  };

  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') router.push('/profile');
    else if (menuName === '每日紀錄') router.push('/daily-record'); 
    else if (menuName === '歷史紀錄') router.push('/history');
    else if (menuName === '身體指數查詢') router.push('/body-metrics');
    else if (menuName === '查詢商品') router.push('/products');
    else if (menuName === '成就管理') router.push('/achievements');
  };

  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', multiplier: 1.2, label: 'BMR x 1.2' },
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', multiplier: 1.375, label: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', multiplier: 1.55, label: 'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', multiplier: 1.72, label: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', multiplier: 1.9, label: 'BMR x 1.9' },
  ];

  // Web 專用 Select 樣式
  const webSelectStyle = {
    fontSize: '18px',
    color: '#333',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'right' as const,
    fontFamily: 'inherit',
    outline: 'none',
    width: '140px',
    fontWeight: '500',
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
                <Text style={[styles.headerMenu, item === '身體指數查詢' && styles.activeMenu]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>

      {/* 主內容區 */}
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContainer} scrollEnabled={Platform.OS !== 'web'} showsVerticalScrollIndicator={false}>
          <View style={styles.metricsCard}>
            
            {/* 左側：BMR 卡片 */}
            <View style={styles.bmrSection}>
              <View style={styles.bmrCard}>
                <Text style={styles.bmrMainTitle}>基礎代謝率BMR</Text>
                
                <View style={styles.bmrList}>
                  {/* 生理性別 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>生 理 性 別</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.gender}
                        onChange={(e) => setMetricsData({ ...metricsData, gender: e.target.value })}
                        style={webSelectStyle}
                      >
                        <option value="">請選擇</option>
                        {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={styles.bmrInput}
                        value={metricsData.gender}
                        placeholder="請輸入男/女"
                        placeholderTextColor="#BBB"
                        onChangeText={(text) => setMetricsData({ ...metricsData, gender: text })}
                      />
                    )}
                  </View>

                  {/* 年齡 (新增 Web 下拉選單) */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>年     齡</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.age}
                        onChange={(e) => setMetricsData({ ...metricsData, age: e.target.value })}
                        style={webSelectStyle}
                      >
                        <option value="">請選擇(歲)</option>
                        {ageOptions.map(a => <option key={a} value={a}>{a} 歲</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={styles.bmrInput}
                        value={metricsData.age}
                        placeholder="請輸入年齡"
                        placeholderTextColor="#BBB"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData({ ...metricsData, age: text.replace(/[^0-9]/g, '') })}
                      />
                    )}
                  </View>

                  {/* 身高 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>身     高</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.height}
                        onChange={(e) => setMetricsData({ ...metricsData, height: e.target.value })}
                        style={webSelectStyle}
                      >
                        <option value="">請選擇(cm)</option>
                        {heightOptions.map(h => <option key={h} value={h}>{h} cm</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={styles.bmrInput}
                        value={metricsData.height}
                        placeholder="請輸入(cm)"
                        placeholderTextColor="#BBB"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData({ ...metricsData, height: text })}
                      />
                    )}
                  </View>

                  {/* 體重 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>體     重</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.weight}
                        onChange={(e) => setMetricsData({ ...metricsData, weight: e.target.value })}
                        style={webSelectStyle}
                      >
                        <option value="">請選擇(kg)</option>
                        {weightOptions.map(w => <option key={w} value={w}>{w} kg</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={styles.bmrInput}
                        value={metricsData.weight}
                        placeholder="請輸入(kg)"
                        placeholderTextColor="#BBB"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData({ ...metricsData, weight: text })}
                      />
                    )}
                  </View>

                  {/* BMI (連動後自動高亮顯示數值) */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>B  M  I</Text>
                    <Text style={[styles.bmrValueText, metricsData.bmi !== '---' && styles.activeValueText]}>
                      {metricsData.bmi}
                    </Text>
                  </View>
                </View>
                
                {/* 計算結果 */}
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>計算結果：</Text>
                  <Text style={[styles.resultValue, metricsData.isCalculated && styles.activeBmrText]}>
                    {metricsData.isCalculated ? `${metricsData.bmrValue} kcal` : 'BMR'}
                  </Text>
                </View>

                {/* 按鈕組合 */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={styles.calculateButton} onPress={handleManualCalculate}>
                    <Text style={styles.calculateButtonText}>開始計算指數</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.syncButton} onPress={handleSyncProfile}>
                    <Text style={styles.syncButtonText}>同步會員中心資料</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 右側：TDEE 區塊 */}
            <View style={styles.tdeeSection}>
              <View style={styles.tdeeTitleBox}>
                <View style={styles.tdeeMainHeader}>
                  <Text style={styles.tdeeTitle}>TDEE</Text>
                  <Text style={styles.tdeeSubTitle}>每日總消耗</Text>
                </View>
                <Text style={styles.tdeeDesc}>人體一整天下來消耗的總熱量</Text>
              </View>

              <View style={styles.tdeeScrollArea}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tdeeItemsContainer}>
                  {tdeeItems.map((item) => {
                    const finalTdeeValue = metricsData.isCalculated 
                      ? `${Math.round(metricsData.bmrValue * item.multiplier)} kcal` 
                      : item.label;

                    return (
                      <View key={item.id} style={styles.tdeeItemBox}>
                        <Text style={styles.activityTitle}>{item.title}</Text>
                        <Text style={styles.activitySub}>{item.sub}</Text>
                        <Text style={styles.formulaText}>
                          {item.label} = <Text style={styles.orangeHighlight}>{finalTdeeValue}</Text>
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } }) },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.7 },
  activeMenu: { opacity: 1, fontWeight: 'bold' },
  memberCenterBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  memberCenterText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  content: { flex: 1, backgroundColor: '#F6EFE5' },
  scrollContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { height: 'calc(100vh - 100px)' } }) },
  metricsCard: { width: '85%', maxWidth: 1000, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', height: '100%' },
  
  bmrSection: { flex: 1, maxWidth: 460, marginRight: 20 },
  bmrCard: { backgroundColor: 'white', borderRadius: 35, paddingHorizontal: 45, paddingVertical: 35, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8 },
  bmrMainTitle: { fontSize: 32, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 30, letterSpacing: 0.5 },
  bmrList: { marginBottom: 15 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  bmrLabel: { fontSize: 20, fontWeight: '600', color: '#333', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, 
  
  bmrInput: { fontSize: 18, color: '#333', textAlign: 'right', width: '140px', fontWeight: '500', padding: 0, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  bmrValueText: { fontSize: 18, color: '#BBB', fontWeight: '500', textAlign: 'right', width: '140px' },
  activeValueText: { color: '#333', fontWeight: '600' },
  
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 25, marginBottom: 25, justifyContent: 'center' },
  resultLabel: { fontSize: 24, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 32, color: '#BBB', fontWeight: 'bold', marginLeft: 10 },
  activeBmrText: { color: '#E28743' },

  buttonContainer: { gap: 12 },
  calculateButton: {
    backgroundColor: '#E28743',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E28743',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  calculateButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },

  syncButton: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E28743',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: { color: '#E28743', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  tdeeSection: { flex: 1, marginLeft: 20, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' },
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 30, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#000', marginRight: 10, letterSpacing: 1 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#000' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  
  tdeeScrollArea: { flex: 1, ...Platform.select({ web: { maxHeight: 'calc(100vh - 360px)' } }) },
  tdeeItemsContainer: { paddingBottom: 20 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#000', textAlign: 'center' },
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});