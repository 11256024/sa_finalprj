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

  // 從 LocalStorage 同步會員資料
  useEffect(() => {
    try {
      let savedProfile = null;
      if (Platform.OS === 'web') {
        const localData = localStorage.getItem('user_profile');
        if (localData) savedProfile = JSON.parse(localData);
      }

      if (savedProfile && savedProfile.gender && savedProfile.height && savedProfile.weight && savedProfile.birthday) {
        const birthDate = new Date(savedProfile.birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        runCalculation(savedProfile.gender, age.toString(), savedProfile.height, savedProfile.weight);
      }
    } catch (error) {
      console.error("自動同步會員資料時發生錯誤：", error);
    }
  }, []);

  // 即時計算 BMI
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

  const runCalculation = (gender: string, ageStr: string, heightStr: string, weightStr: string) => {
    const weight = parseFloat(weightStr);
    const height = parseFloat(heightStr);
    const age = parseInt(ageStr);

    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);

    let bmr = 10 * weight + 6.25 * height - 5 * age;
    if (gender === '男') bmr += 5;
    else bmr -= 161;
    const finalBmr = Math.round(bmr);

    setMetricsData(prev => ({
      ...prev,
      gender,
      age: age.toString(),
      height: height.toString(),
      weight: weight.toString(),
      bmi,
      bmrValue: finalBmr,
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

  // 控制外面「平時看得到的文字」顏色
  const getWebSelectStyle = (hasValue: boolean, fieldKey: 'gender' | 'age' | 'height' | 'weight') => {
    let textColor = '#E0E0E0'; 
    if (hasValue) {
      textColor = isModified[fieldKey] ? '#333333' : '#999999'; // 會員拉來的顯示淺灰，自己改的變深黑
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
      fontWeight: '500',
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
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>林</Text>
            </View>
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
                        {/* 💡 修正：下拉選單打開後，所有的選項（包含請選擇）字體全部牢牢鎖定為深黑色 #333333 */}
                        <option value="" style={{ color: '#333333' }}>請選擇</option>
                        {genderOptions.map(g => <option key={g} value={g} style={{ color: '#333333' }}>{g}</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[
                          styles.bmrInput, 
                          metricsData.gender !== '' && (isModified.gender ? styles.darkValueText : styles.lightValueText)
                        ]}
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
                    <Text style={styles.bmrLabel}>年    齡</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.age}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, age: e.target.value });
                          setIsModified(prev => ({ ...prev, age: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.age, 'age')}
                      >
                        {/* 💡 修正：選單內的字全部維持深黑色 #333333 */}
                        <option value="" style={{ color: '#333333' }}>請選擇(歲)</option>
                        {ageOptions.map(a => <option key={a} value={a} style={{ color: '#333333' }}>{a} 歲</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[
                          styles.bmrInput, 
                          metricsData.age !== '' && (isModified.age ? styles.darkValueText : styles.lightValueText)
                        ]}
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

                  {/* 身高 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>身    高</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.height}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, height: e.target.value });
                          setIsModified(prev => ({ ...prev, height: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.height, 'height')}
                      >
                        {/* 💡 修正：選單內的字全部維持深黑色 #333333 */}
                        <option value="" style={{ color: '#333333' }}>請選擇(cm)</option>
                        {heightOptions.map(h => <option key={h} value={h} style={{ color: '#333333' }}>{h} cm</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[
                          styles.bmrInput, 
                          metricsData.height !== '' && (isModified.height ? styles.darkValueText : styles.lightValueText)
                        ]}
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

                  {/* 體重 */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>體    重</Text>
                    {Platform.OS === 'web' ? (
                      <select
                        value={metricsData.weight}
                        onChange={(e) => {
                          setMetricsData({ ...metricsData, weight: e.target.value });
                          setIsModified(prev => ({ ...prev, weight: true }));
                        }}
                        style={getWebSelectStyle(!!metricsData.weight, 'weight')}
                      >
                        {/* 💡 修正：選單內的字全部維持深黑色 #333333 */}
                        <option value="" style={{ color: '#333333' }}>請選擇(kg)</option>
                        {weightOptions.map(w => <option key={w} value={w} style={{ color: '#333333' }}>{w} kg</option>)}
                      </select>
                    ) : (
                      <TextInput
                        style={[
                          styles.bmrInput, 
                          metricsData.weight !== '' && (isModified.weight ? styles.darkValueText : styles.lightValueText)
                        ]}
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

                  {/* BMI */}
                  <View style={styles.bmrRow}>
                    <Text style={styles.bmrLabel}>B  M  I</Text>
                    <Text style={[styles.bmrValueText, metricsData.bmi !== '---' && styles.darkValueText]}>
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

                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={styles.calculateButton} onPress={handleManualCalculate}>
                    <Text style={styles.calculateButtonText}>開始計算指數</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 右側 TDEE */}
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
                          {item.label} = <Text style={[styles.grayHighlight, metricsData.isCalculated && styles.orangeHighlight]}>{finalTdeeValue}</Text>
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
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, 
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } }) 
  },
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
  bmrValueText: { fontSize: 18, color: '#DCDCDC', fontWeight: '500', textAlign: 'right', width: '140px' }, 
  
  lightValueText: { color: '#999999', fontWeight: '600' }, 
  darkValueText: { color: '#333333', fontWeight: '600' },  
  
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