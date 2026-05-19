import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  // 用來追蹤使用者有沒有「手動改過」選單
  const [isModified, setIsModified] = useState({
    gender: false,
    age: false,
    height: false,
    weight: false
  });

  // 用於判斷目前系統「有沒有身高數據」的狀態防呆
  const [hasHeightData, setHasHeightData] = useState(true);

  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  const ageOptions = Array.from({ length: 91 }, (_, i) => (i + 10).toString());
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString());
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());
  const genderOptions = ['男', '女'];

  // 🛠️ 輔助函式：根據 BMI 數值判斷體重狀態字串
  const getBmiStatusText = (bmiNum: number): string => {
    if (bmiNum < 18.5) return '體重過輕';
    if (bmiNum >= 18.5 && bmiNum < 24) return '正常範圍';
    if (bmiNum >= 24 && bmiNum < 27) return '異常過重';
    return '肥胖';
  };

  // 🎯 核心：精準對照 Profile 會員中心資料與當天體重紀錄
  useEffect(() => {
    try {
      let savedProfile = null;
      let todayWeight = '';

      // 1. 取得當前選定或查詢的「當天日期」
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
        // 2. 讀取會員中心設定檔 (取得性別、年齡、身高、初始體重)
        const localData = localStorage.getItem('user_profile');
        if (localData) savedProfile = JSON.parse(localData);

        // 3. 依據當天日期鍵值，撈取每日紀錄中的體重
        const dailyRecordData = localStorage.getItem(`daily_record_${targetDateStr}`);
        if (dailyRecordData) {
          const parsedRecord = JSON.parse(dailyRecordData);
          if (parsedRecord.weight) {
            todayWeight = parsedRecord.weight.toString();
          }
        }
      }

      // 4. 檢查身高（一律以會員 Profile 的身高為準）
      const profileHeight = savedProfile?.height || '';
      if (!profileHeight || parseFloat(profileHeight) <= 0) {
        setHasHeightData(false); 
      } else {
        setHasHeightData(true);
      }

      if (savedProfile) {
        // 5. 🎯 直接對照 Profile 會員中心的年齡欄位，不再自行換算
        const finalAge = savedProfile.age ? savedProfile.age.toString() : '';

        // 6. 體重優先權：當天紀錄有填就抓當天的，沒有才拿會員檔初始體重頂替
        const finalWeight = todayWeight.trim() !== '' ? todayWeight : (savedProfile.weight || '');
        const finalHeight = profileHeight;
        const finalGender = savedProfile.gender || '';

        // 7. 會員資料齊全且有身高，自動執行初次指數計算與載入
        if (finalGender && finalAge && finalHeight && finalWeight && parseFloat(finalHeight) > 0) {
          const weightNum = parseFloat(finalWeight);
          const heightNum = parseFloat(finalHeight);
          const ageNum = parseInt(finalAge);
          
          const heightInMeters = heightNum / 100;
          const bmi = (weightNum / (heightInMeters * heightInMeters)).toFixed(1);
          const bmiStatus = getBmiStatusText(parseFloat(bmi));

          let bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum;
          if (finalGender === '男') bmr += 5;
          else bmr -= 161;

          setMetricsData({
            gender: finalGender,
            age: finalAge,
            height: finalHeight,
            weight: finalWeight,
            bmi,
            bmiStatus,
            bmrValue: Math.round(bmr),
            isCalculated: true
          });
        } else {
          // 若有缺少，先將撈出來的欄位預設帶入
          setMetricsData(prev => ({
            ...prev,
            gender: finalGender,
            age: finalAge,
            height: finalHeight,
            weight: finalWeight,
          }));
        }
      }
    } catch (error) {
      console.error("同步 Profile 資料與每日體重時發生錯誤：", error);
    }
  }, []);

  // 即時監聽：當使用者在畫面上手動重新選擇下拉選單時觸發
  useEffect(() => {
    const height = parseFloat(metricsData.height);
    const weight = parseFloat(metricsData.weight);

    if (isNaN(height) || height <= 0) {
      setHasHeightData(false);
      return;
    } else {
      setHasHeightData(true);
    }

    if (weight > 0 && height > 0) {
      const heightInMeters = height / 100;
      const calculatedBmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
      const statusText = getBmiStatusText(parseFloat(calculatedBmi));
      setMetricsData(prev => ({ 
        ...prev, 
        bmi: calculatedBmi,
        bmiStatus: statusText
      }));
    } else {
      setMetricsData(prev => ({ ...prev, bmi: '---', bmiStatus: '' }));
    }
  }, [metricsData.height, metricsData.weight]);

  const handleManualCalculate = () => {
    if (!hasHeightData || !metricsData.height) {
      if (Platform.OS === 'web') {
        window.alert('⚠️ 無法計算：請先至會員中心輸入身高數據！');
      } else {
        alert('無法計算：請先至會員中心輸入身高數據！');
      }
      return;
    }

    if (!metricsData.gender || !metricsData.age || !metricsData.height || !metricsData.weight) {
      if (Platform.OS === 'web') {
        window.alert('請填寫完整的性別、年齡、身高、體重資訊後再進行計算！');
      } else {
        alert('請填寫完整的數據資訊！');
      }
      return;
    }
    
    // 執行手動重新計算邏輯
    const weight = parseFloat(metricsData.weight);
    const height = parseFloat(metricsData.height);
    const age = parseInt(metricsData.age);
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    const bmiStatus = getBmiStatusText(parseFloat(bmi));

    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (metricsData.gender === '男') bmr += 5;
    else bmr -= 161;

    setMetricsData(prev => ({
      ...prev,
      bmi,
      bmiStatus,
      bmrValue: Math.round(bmr),
      isCalculated: true
    }));
  };

  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', multiplier: 1.2, label: 'BMR x 1.2' },
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', multiplier: 1.375, label: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', multiplier: 1.55, label: 'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', multiplier: 1.72, label: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', multiplier: 1.9, label: 'BMR x 1.9' },
  ];

  const getWebSelectStyle = (hasValue: boolean, fieldKey: 'gender' | 'age' | 'height' | 'weight') => {
    let textColor = '#E0E0E0'; 
    if (hasValue) {
      textColor = isModified[fieldKey] ? '#333333' : '#999999';
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
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.name === '身體指數查詢' && pathname.includes('body-metrics'));
              return (
                <TouchableOpacity key={item.name} onPress={() => router.push(item.path as any)} style={styles.menuButton}>
                  <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.defaultAvatar}><Text style={styles.defaultAvatarText}>林</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* 主內容區 */}
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
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, gender: e.target.value });
                          setIsModified(prev => ({ ...prev, gender: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.gender, 'gender')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇</option>
                        {genderOptions.map(g => <option key={g} value={g} style={{ color: '#333333' }}>{g}</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.gender !== '' && (isModified.gender ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.gender}
                        placeholder="請輸入男/女"
                        placeholderTextColor="#E0E0E0"
                        onChangeText={(text) => {
                          setMetricsData({ ...metricsData, gender: text });
                          setIsModified(prev => ({ ...prev, gender: true }));
                        }}
                      />
                    )}
                  </View>

                  {/* 年齡 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>年     齡</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.age}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, age: e.target.value });
                          setIsModified(prev => ({ ...prev, age: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.age, 'age')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(歲)</option>
                        {ageOptions.map(a => <option key={a} value={a} style={{ color: '#333333' }}>{a} 歲</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.age !== '' && (isModified.age ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.age}
                        placeholder="請輸入年齡"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          setMetricsData({ ...metricsData, age: text.replace(/[^0-9]/g, '') });
                          setIsModified(prev => ({ ...prev, age: true }));
                        }}
                      />
                    )}
                  </View>

                  {/* 身高（參照會員記錄檔） */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>身     高</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.height}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, height: e.target.value });
                          setIsModified(prev => ({ ...prev, height: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.height, 'height')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(cm)</option>
                        {heightOptions.map(h => <option key={h} value={h} style={{ color: '#333333' }}>{h} cm</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.height !== '' && (isModified.height ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.height}
                        placeholder="請輸入(cm)"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          setMetricsData({ ...metricsData, height: text });
                          setIsModified(prev => ({ ...prev, height: true }));
                        }}
                      />
                    )}
                  </View>

                  {/* 體重（優先參照每日紀錄檔當天資料） */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>體     重</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.weight}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, weight: e.target.value });
                          setIsModified(prev => ({ ...prev, weight: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.weight, 'weight')}
                      >
                        <option value="" style={{ color: '#333333' }}>請選擇(kg)</option>
                        {weightOptions.map(w => <option key={w} value={w} style={{ color: '#333333' }}>{w} kg</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[styles.bmrInput, metricsData.weight !== '' && (isModified.weight ? styles.darkValueText : styles.lightValueText)]}
                        value={metricsData.weight}
                        placeholder="請輸入(kg)"
                        placeholderTextColor="#E0E0E0"
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          setMetricsData({ ...metricsData, weight: text });
                          setIsModified(prev => ({ ...prev, weight: true }));
                        }}
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
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, zIndex: 10, ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } }) },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8, paddingBottom: 4 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' },
  
  content: { flex: 1, backgroundColor: '#F6EFE5' },
  scrollContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { height: 'calc(100vh - 100px)' } }) },
  metricsLayout: { width: '90%', maxWidth: 1200, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', height: '100%' },
  
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

  tdeeSection: { flex: 1, marginLeft: 25, height: '100%' },
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#333', marginRight: 10 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  
  tdeeScrollArea: { flex: 1, ...Platform.select({ web: { maxHeight: 'calc(100vh - 340px)' } }) },
  tdeeItemsContainer: { paddingBottom: 20 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 22, marginBottom: 16 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#333', textAlign: 'center' },
  grayHighlight: { color: '#DCDCDC', fontWeight: '500' }, 
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});