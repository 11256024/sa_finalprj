import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BodyMetricsScreen() {
  const router = useRouter();
  const pathname = usePathname();

  // 核心數據狀態
  const [metricsData, setMetricsData] = useState({
    gender: '',
    age: '',
    height: '',
    weight: '',
    bmi: '---',
    bmiStatus: '', 
    bmrValue: 0,
    isCalculated: false
  });

  // 保存最乾淨、沒有被動過的初始對照組資料
  const [initialProfile, setInitialProfile] = useState<{gender?: string, age?: string, height?: string, weight?: string} | null>(null);

  // 用於判斷目前系統「有沒有身高數據」的狀態防呆
  const [hasHeightData, setHasHeightData] = useState(true);

  // 🎯 關鍵修復：從 0 開始，生成 ['0', '1', '2', ..., '100'] 的陣列
  const ageOptions = Array.from({ length: 101 }, (_, i) => i.toString());
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString());
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());
  const genderOptions = ['男', '女'];

  // 輔助函式：根據 BMI 數值判斷體重狀態字串
  const getBmiStatusText = (bmiNum: number): string => {
    if (bmiNum < 18.5) return '體重過輕';
    if (bmiNum >= 18.5 && bmiNum < 24) return '正常範圍';
    if (bmiNum >= 24 && bmiNum < 27) return '異常過重';
    return '肥胖';
  };

  // 初始化：初次進入畫面時精準對照 Profile 的所有欄位（包含 0~6 歲）
  useEffect(() => {
    try {
      let savedProfile = null;
      let todayWeight = '';

      let targetDateStr = '';
      if (Platform.OS === 'web') {
        targetDateStr = localStorage.getItem('current_selected_date') || '';
      }

      if (!targetDateStr) {
        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const month = String(todayObj.getMonth() + 1).padStart(2, '0');
        const day = String(todayObj.getDate()).padStart(2, '0');
        targetDateStr = `${year}-${month}-${day}`; 
      }

      if (Platform.OS === 'web') {
        const localData = localStorage.getItem('user_profile');
        if (localData) savedProfile = JSON.parse(localData);

        const dailyRecordData = localStorage.getItem(`daily_record_${targetDateStr}`);
        if (dailyRecordData) {
          const parsedRecord = JSON.parse(dailyRecordData);
          if (parsedRecord.weight) {
            todayWeight = parsedRecord.weight.toString();
          }
        }
      }

      const profileHeight = savedProfile?.height || '';
      setHasHeightData(!(!profileHeight || parseFloat(profileHeight) <= 0));

      if (savedProfile) {
        // 確保年齡有被正確取出並轉成字串，只留下數字
        let finalAge = '';
        if (savedProfile.age !== undefined && savedProfile.age !== null) {
          finalAge = savedProfile.age.toString().replace(/[^0-9]/g, ''); 
        }
        
        const finalWeight = todayWeight.trim() !== '' ? todayWeight : (savedProfile.weight || '').toString();
        const finalHeight = profileHeight.toString();
        const finalGender = savedProfile.gender || '';

        // 將撈到的原始資料完整存入「對照組狀態」
        setInitialProfile({
          gender: finalGender,
          age: finalAge,
          height: finalHeight,
          weight: finalWeight
        });

        // 塞入畫面顯示欄位的 State
        setMetricsData(prev => ({
          ...prev,
          gender: finalGender,
          age: finalAge,
          height: finalHeight,
          weight: finalWeight,
        }));
      }
    } catch (error) {
      console.error("同步 Profile 資料與每日體重時發生錯誤：", error);
    }
  }, []);

  // 響應式核心：當任何核心數據變動時，自動計算/更新所有指數 (BMI, BMR)
  useEffect(() => {
    const { gender, age, height, weight } = metricsData;
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    const ageNum = parseInt(age);

    if (isNaN(heightNum) || heightNum <= 0) {
      setHasHeightData(false);
      setMetricsData(prev => ({ ...prev, bmi: '---', bmiStatus: '', bmrValue: 0, isCalculated: false }));
      return;
    } else {
      setHasHeightData(true);
    }

    // 這裡防呆修改：因為年齡可以是 0，所以不能用 !isNaN(ageNum) && ageNum 判斷（因為 0 在 JS 是 false）
    // 改用 !isNaN(ageNum) && ageNum >= 0
    if (gender && !isNaN(ageNum) && ageNum >= 0 && !isNaN(heightNum) && !isNaN(weightNum) && weightNum > 0) {
      const heightInMeters = heightNum / 100;
      const bmi = (weightNum / (heightInMeters * heightInMeters)).toFixed(1);
      const bmiStatus = getBmiStatusText(parseFloat(bmi));

      // Mifflin-St Jeor 公式計算 BMR
      let bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum;
      if (gender === '男') bmr += 5;
      else if (gender === '女') bmr -= 161;

      setMetricsData(prev => ({
        ...prev,
        bmi,
        bmiStatus,
        bmrValue: Math.round(bmr),
        isCalculated: true
      }));
    } else {
      setMetricsData(prev => ({
        ...prev,
        bmi: '---',
        bmiStatus: '',
        bmrValue: 0,
        isCalculated: false
      }));
    }
  }, [metricsData.gender, metricsData.age, metricsData.height, metricsData.weight]);

  const handleManualCalculate = () => {
    if (!hasHeightData || !metricsData.height) {
      const msg = '⚠️ 無法計算：請先至會員中心輸入身高數據！';
      Platform.OS === 'web' ? window.alert(msg) : alert(msg);
      return;
    }

    if (!metricsData.gender || metricsData.age === '' || !metricsData.height || !metricsData.weight) {
      const msg = '請填寫完整的性別、年齡、身高、體重資訊！';
      Platform.OS === 'web' ? window.alert(msg) : alert(msg);
      return;
    }
    
    const successMsg = '✨ 指數已即時更新至最新狀態！';
    Platform.OS === 'web' ? window.alert(successMsg) : alert(successMsg);
  };

  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', multiplier: 1.2, label: 'BMR x 1.2' },
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', multiplier: 1.375, label: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', multiplier: 1.55, label: 'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', multiplier: 1.72, label: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', multiplier: 1.9, label: 'BMR x 1.9' },
  ];

  // 決定 Web 端 select 的字體顏色
  const getWebSelectStyle = (hasValue: boolean, fieldKey: 'gender' | 'age' | 'height' | 'weight') => {
    let textColor = '#E0E0E0'; 
    if (hasValue) {
      const isReallyChanged = metricsData[fieldKey] !== initialProfile?.[fieldKey];
      textColor = isReallyChanged ? '#333333' : '#999999';
    }

    return {
      fontSize: '18px',
      color: textColor,
      backgroundColor: 'transparent',
      border: 'none',
      textAlign: 'right' as const,
      fontFamily: 'inherit',
      outline: 'none',
      width: '140px',
      fontWeight: '500' as const,
      cursor: 'pointer',
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContainer} scrollEnabled={Platform.OS !== 'web'} showsVerticalScrollIndicator={false}>
          <View style={styles.metricsLayout}>
            
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
                        onChange={(e) => setMetricsData(prev => ({ ...prev, gender: e.target.value }))}
                        style={getWebSelectStyle(!!metricsData.gender, 'gender')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇</option>
                        {genderOptions.map(g => <option key={g} value={g} style={{ color: '#333333' }}>{g}</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.gender !== '' && (metricsData.gender !== initialProfile?.gender ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.gender}
                        placeholder="請輸入男/女"
                        placeholderTextColor="#E0E0E0"
                        onChangeText={(text) => setMetricsData(prev => ({ ...prev, gender: text }))}
                      />
                    )}
                  </View>

                  {/* 年齡 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>年      齡</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.age}
                        onChange={(e) => setMetricsData(prev => ({ ...prev, age: e.target.value }))}
                        style={getWebSelectStyle(metricsData.age !== '', 'age')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(歲)</option>
                        {ageOptions.map(a => <option key={a} value={a} style={{ color: '#333333' }}>{a} 歲</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.age !== '' && (metricsData.age !== initialProfile?.age ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.age}
                        placeholder="請輸入年齡"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
                      />
                    )}
                  </View>

                  {/* 身高 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>身      高</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.height}
                        onChange={(e) => setMetricsData(prev => ({ ...prev, height: e.target.value }))}
                        style={getWebSelectStyle(!!metricsData.height, 'height')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(cm)</option>
                        {heightOptions.map(h => <option key={h} value={h} style={{ color: '#333333' }}>{h} cm</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.height !== '' && (metricsData.height !== initialProfile?.height ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.height}
                        placeholder="請輸入(cm)"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData(prev => ({ ...prev, height: text }))}
                      />
                    )}
                  </View>

                  {/* 體重 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>體      重</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.weight}
                        onChange={(e) => setMetricsData(prev => ({ ...prev, weight: e.target.value }))}
                        style={getWebSelectStyle(!!metricsData.weight, 'weight')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(kg)</option>
                        {weightOptions.map(w => <option key={w} value={w} style={{ color: '#333333' }}>{w} kg</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.weight !== '' && (metricsData.weight !== initialProfile?.weight ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.weight}
                        placeholder="請輸入(kg)"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => setMetricsData(prev => ({ ...prev, weight: text }))}
                      />
                    )}
                  </View>

                  {/* BMI 區塊 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>B  M  I</Text>
                    {!hasHeightData ? (
                      <Text style={styles.errorRedText}>請至會員中心輸入身高數據</Text>
                    ) : (
                      <Text style={[styles.bmrValueText, metricsData.bmi !== '---' && styles.darkValueText]}>
                        {metricsData.bmi} {metricsData.bmiStatus ? `(${metricsData.bmiStatus})` : ''}
                      </Text>
                    )}
                  </View>
                </View>
                
                {/* 計算結果區塊 */}
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>計算結果：</Text>
                  {!hasHeightData ? (
                    <Text style={[styles.errorRedText, { fontSize: 20, marginLeft: 10, alignSelf: 'center' }]}>請至會員中心輸入身高數據</Text>
                  ) : (
                    <Text style={[styles.resultValue, metricsData.isCalculated && styles.activeBmrText]}>
                      {metricsData.isCalculated ? `${metricsData.bmrValue} kcal` : 'BMR'}
                    </Text>
                  )}
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={styles.calculateButton} onPress={handleManualCalculate}>
                    <Text style={styles.calculateButtonText}>重新計算指數</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 右側 TDEE 區塊 */}
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
                    let finalTdeeValue = item.label;
                    
                    if (!hasHeightData) {
                      finalTdeeValue = '請至會員中心輸入身高數據';
                    } else if (metricsData.isCalculated) {
                      finalTdeeValue = `${Math.round(metricsData.bmrValue * item.multiplier)} kcal`;
                    }

                    return (
                      <View key={item.id} style={styles.tdeeItemBox}>
                        <Text style={styles.activityTitle}>{item.title}</Text>
                        <Text style={styles.activitySub}>{item.sub}</Text>
                        <Text style={styles.formulaText}>
                          {item.label} = <Text style={[
                            styles.grayHighlight, 
                            metricsData.isCalculated && hasHeightData && styles.orangeHighlight,
                            !hasHeightData && styles.errorRedTextSmall
                          ]}>{finalTdeeValue}</Text>
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
  container: { flex: 1, backgroundColor: '#F6EFE5' }, 
  content: { flex: 1, backgroundColor: '#F6EFE5' },
  scrollContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { minHeight: 'calc(100vh - 100px)' } }) },
  metricsLayout: { width: '90%', maxWidth: 1200, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },
  bmrSection: { flex: 1, maxWidth: 460, marginRight: 25 },
  bmrCard: { backgroundColor: 'white', borderRadius: 35, paddingHorizontal: 40, paddingVertical: 35, elevation: 4 },
  bmrMainTitle: { fontSize: 32, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 30 },
  bmrList: { marginBottom: 15 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  bmrLabel: { fontSize: 20, fontWeight: '600', color: '#444', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, 
  bmrInput: { fontSize: 18, textAlign: 'right', width: '140px', fontWeight: '500', padding: 0 },
  bmrValueText: { fontSize: 18, color: '#DCDCDC', fontWeight: '500', textAlign: 'right', width: '190px' }, 
  lightValueText: { color: '#999999', fontWeight: '600' }, 
  darkValueText: { color: '#333333', fontWeight: '600' },  
  errorRedText: { color: '#E74C3C', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  errorRedTextSmall: { color: '#E74C3C', fontSize: 18, fontWeight: 'bold' },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 25, marginBottom: 25, justifyContent: 'center' },
  resultLabel: { fontSize: 24, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 32, color: '#DCDCDC', fontWeight: 'bold', marginLeft: 10 }, 
  activeBmrText: { color: '#E28743' },
  buttonContainer: { gap: 12 },
  calculateButton: { backgroundColor: '#E28743', borderRadius: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  calculateButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tdeeSection: { flex: 1, marginLeft: 25 },
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#333', marginRight: 10 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  tdeeScrollArea: { width: '100%' },
  tdeeItemsContainer: { paddingBottom: 20 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 22, marginBottom: 16 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#333', textAlign: 'center' },
  grayHighlight: { color: '#DCDCDC', fontWeight: '500' }, 
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});