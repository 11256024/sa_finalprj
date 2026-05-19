import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function BodyMetricsScreen() {
  const isFocused = useIsFocused();

  // 核心數據狀態 - 初始一律為空字串，對齊選單的「請選擇」
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

  // 用來記錄同步進來的有效值（比對顏色用）
  const [initialProfile, setInitialProfile] = useState<{gender?: string, age?: string, height?: string, weight?: string} | null>(null);

  // 下拉選單項目定義
  const genderOptions = ['', '男', '女'];
  const ageOptions = ['', ...Array.from({ length: 100 }, (_, i) => (i + 1).toString())]; 
  const heightOptions = ['', ...Array.from({ length: 151 }, (_, i) => (i + 100).toString())]; 
  const weightOptions = ['', ...Array.from({ length: 171 }, (_, i) => (i + 30).toString())]; 

  const getBmiStatusText = (bmiNum: number): string => {
    if (bmiNum < 18.5) return '體重過輕';
    if (bmiNum >= 18.5 && bmiNum < 24) return '正常範圍';
    if (bmiNum >= 24 && bmiNum < 27) return '異常過重';
    return '肥胖';
  };

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const showAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert("提示", message);
    }
  };

  // 🔄 核心清洗與解析函式（體重嚴格鎖定每日紀錄檔）
  const parseAndCleanProfile = (
    userProfileRaw: string | null, 
    todayFoodWeight: string, 
    scannedHeight: string
  ) => {
    let savedProfile: any = null;
    if (userProfileRaw) {
      try { savedProfile = JSON.parse(userProfileRaw); } catch (e) {}
    }

    // 1. 身高抓取：地毯式掃描出的優先，否則取 profile
    let rawHeight = scannedHeight || savedProfile?.height || '';
    let cleanHeight = (rawHeight === '請選擇身高' || !rawHeight || rawHeight.toString().includes('請選擇')) 
      ? '' 
      : rawHeight.toString().replace(/[^0-9.]/g, '').trim();

    // 2. 體重抓取：🎯 嚴格規定只抓取今天當天飲食紀錄檔的體重
    let rawWeight = todayFoodWeight; // 👈 砍掉舊有 fallback 到 profile 的邏輯，只看當天紀錄
    let cleanWeight = (rawWeight === '請選擇體重' || !rawWeight || rawWeight.toString().includes('請選擇')) 
      ? '' 
      : rawWeight.toString().replace(/[^0-9.]/g, '').trim(); 

    // 🛑 真正安全的防老鼠屎機制 (只阻斷整包 Json 字串或極端幽靈數字)
    const parsedWeight = parseFloat(cleanWeight);
    if (cleanWeight.includes('{') || isNaN(parsedWeight) || parsedWeight > 500 || parsedWeight < 2) {
      cleanWeight = '';
    } else {
      cleanWeight = parsedWeight.toString();
    }

    // 3. 性別解析
    let rawGender = savedProfile?.gender || '';
    let cleanGender = (rawGender === '請選擇性別' || !rawGender || rawGender.toString().includes('請選擇')) ? '' : rawGender.trim();

    // 4. 年齡解析
    let finalAge = '';
    let isZeroAge = false;

    if (savedProfile && savedProfile.age !== undefined && savedProfile.age !== null && savedProfile.age !== '') {
      finalAge = savedProfile.age.toString().replace(/[^0-9]/g, '').trim(); 
    } else if (savedProfile?.birthday && !savedProfile.birthday.includes('請選擇')) {
      const birthdayStr = savedProfile.birthday.toString();
      const yearMatch = birthdayStr.match(/\d{4}/);
      
      if (yearMatch) {
        const birthYear = parseInt(yearMatch[0], 10);
        const currentYear = new Date().getFullYear();
        if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= currentYear) {
          finalAge = (currentYear - birthYear).toString();
        }
      }
    }
    
    if (finalAge === '0') {
      isZeroAge = true;
      finalAge = ''; 
    }

    return { cleanGender, finalAge, cleanHeight, cleanWeight, isZeroAge };
  };

  // 💥【自動化載入】每次進入頁面或切換帳號時，精準讀取與即時清空
  useEffect(() => {
    const autoLoadOrReset = async () => {
      if (isFocused) {
        try {
          // 1. 取得當前登入的 User ID
          const savedUserId = await AsyncStorage.getItem('current_user_id') || 'guest';
          
          // 🛑【核心修正】先手動把舊畫面的殘留數據與對比狀態全部清空！
          // 確保切換帳號後，如果是沒有填寫的新帳號，底子能完全恢復初始狀態
          setMetricsData({
            gender: '',
            age: '',
            height: '',
            weight: '',
            bmi: '---',
            bmiStatus: '', 
            bmrValue: 0,
            isCalculated: false
          });
          setInitialProfile(null);

          // 🔍 【地毯式身高搜查】
          let scannedHeight = '';
          const possibleHeightKeys = [
            `${savedUserId}_user_height`,
            `${savedUserId}_height`,
            'user_height_key',
            'user_height',
            'height',
            'member_height'
          ];
          for (const key of possibleHeightKeys) {
            const val = await AsyncStorage.getItem(key);
            if (val && val.trim() !== '') {
              scannedHeight = val;
              break;
            }
          }

          // 🎯 【精準撈取當天紀錄檔體重】
          let todayWeight = '';
          const todayFoodKey = `${savedUserId}_food_record_${getTodayDateString()}`;
          const backupFoodKey = `food_record_${getTodayDateString()}`;
          const dailyFoodRecordRaw = await AsyncStorage.getItem(todayFoodKey) || await AsyncStorage.getItem(backupFoodKey);
          
          if (dailyFoodRecordRaw) {
            try {
              const parsedFood = JSON.parse(dailyFoodRecordRaw);
              if (parsedFood.weight !== undefined && parsedFood.weight !== null) {
                todayWeight = parsedFood.weight.toString().trim();
              }
            } catch (e) {}
          }

          // 讀取該使用者的 Profile (拿來配對性別與年齡)
          const localData = await AsyncStorage.getItem(`${savedUserId}_user_profile`) || await AsyncStorage.getItem('userProfile') || await AsyncStorage.getItem('user_profile');

          const { cleanGender, finalAge, cleanHeight, cleanWeight } = parseAndCleanProfile(localData, todayWeight, scannedHeight);

          // 3. 重新寫入當前使用者的正確資料（若全新帳號抓出來是空的，畫面就會保持乾淨）
          setInitialProfile({ gender: cleanGender, age: finalAge, height: cleanHeight, weight: cleanWeight });
          setMetricsData(prev => ({
            ...prev,
            gender: cleanGender,
            age: finalAge,
            height: cleanHeight,
            weight: cleanWeight,
          }));

        } catch (e) {
          console.error("背景自動同步失敗：", e);
        }
      } else {
        // 💡 當頁面斷開焦點 (離開這一頁、登出) 時，也主動清空，確保安全
        setMetricsData({
          gender: '',
          age: '',
          height: '',
          weight: '',
          bmi: '---',
          bmiStatus: '', 
          bmrValue: 0,
          isCalculated: false
        });
        setInitialProfile(null);
      }
    };

    autoLoadOrReset();
  }, [isFocused]);

  // 🔄 手動點擊「同步會員資料」按鈕邏輯
  const loadSyncProfileData = async () => {
    try {
      const savedUserId = await AsyncStorage.getItem('current_user_id') || 'guest';
      
      let scannedHeight = '';
      const possibleHeightKeys = [
        `${savedUserId}_user_height`,
        `${savedUserId}_height`,
        'user_height_key',
        'user_height',
        'height',
        'member_height'
      ];
      for (const key of possibleHeightKeys) {
        const val = await AsyncStorage.getItem(key);
        if (val && val.trim() !== '') {
          scannedHeight = val;
          break;
        }
      }

      let todayWeight = '';
      const todayFoodKey = `${savedUserId}_food_record_${getTodayDateString()}`;
      const backupFoodKey = `food_record_${getTodayDateString()}`;
      const dailyFoodRecordRaw = await AsyncStorage.getItem(todayFoodKey) || await AsyncStorage.getItem(backupFoodKey);
      
      if (dailyFoodRecordRaw) {
        try {
          const parsedFood = JSON.parse(dailyFoodRecordRaw);
          if (parsedFood.weight !== undefined && parsedFood.weight !== null) {
            todayWeight = parsedFood.weight.toString().trim();
          }
        } catch (e) {}
      }

      const localData = await AsyncStorage.getItem(`${savedUserId}_user_profile`) || await AsyncStorage.getItem('userProfile') || await AsyncStorage.getItem('user_profile');

      const { cleanGender, finalAge, cleanHeight, cleanWeight, isZeroAge } = parseAndCleanProfile(localData, todayWeight, scannedHeight);

      // 🟢 體重防呆攔截：若當天飲食紀錄沒有體重，則彈出警告並不予同步
      if (!cleanWeight || cleanWeight.trim() === '' || parseFloat(cleanWeight) === 0) {
        showAlert('請先到今日飲食紀錄填寫當天體重數據');
        return;
      }

      if (!cleanGender && !finalAge && !cleanHeight) {
        showAlert('⚠️ 請至會員中心填寫詳細資料');
        return; 
      }

      if (isZeroAge) {
        showAlert("請輸入大等於1的歲數，不滿1足歲無法計算TDEE");
        setInitialProfile({ gender: cleanGender, age: '', height: cleanHeight, weight: cleanWeight });
        setMetricsData(prev => ({
          ...prev,
          gender: cleanGender,
          age: '', 
          height: cleanHeight,
          weight: cleanWeight,
        }));
        return; 
      }

      setInitialProfile({ gender: cleanGender, age: finalAge, height: cleanHeight, weight: cleanWeight });
      setMetricsData(prev => ({
        ...prev,
        gender: cleanGender,
        age: finalAge,
        height: cleanHeight,
        weight: cleanWeight,
      }));

      showAlert('✨ 飲食紀錄與會員資料同步成功！');

    } catch (error) {
      console.error("手動同步會員資料錯誤：", error);
    }
  };

  // 📊 自動計算監聽器
  useEffect(() => {
    const { gender, age, height, weight } = metricsData;

    let currentBmi = '---';
    let currentBmiStatus = '';

    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (!isNaN(heightNum) && heightNum > 0 && !isNaN(weightNum) && weightNum > 0) {
      const heightInMeters = heightNum / 100;
      const bmiCalc = (weightNum / (heightInMeters * heightInMeters)).toFixed(1);
      currentBmi = bmiCalc;
      currentBmiStatus = getBmiStatusText(parseFloat(bmiCalc));
    }

    const ageNum = parseInt(age);
    if (!gender || !age || isNaN(heightNum) || heightNum <= 0 || isNaN(weightNum) || weightNum <= 0 || isNaN(ageNum) || ageNum <= 0) {
      setMetricsData(prev => ({
        ...prev,
        bmi: currentBmi,
        bmiStatus: currentBmiStatus,
        bmrValue: 0,
        isCalculated: false
      }));
      return;
    }

    let bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum;
    if (gender === '男') bmr += 5;
    else if (gender === '女') bmr -= 161;

    setMetricsData(prev => ({
      ...prev,
      bmi: currentBmi,
      bmiStatus: currentBmiStatus,
      bmrValue: Math.round(bmr),
      isCalculated: true
    }));

  }, [metricsData.gender, metricsData.age, metricsData.height, metricsData.weight]);

  const handleManualCalculate = () => {
    const { gender, age, height, weight } = metricsData;
    
    if (!weight || weight.trim() === '' || parseFloat(weight) === 0) {
      showAlert('請先到今日飲食紀錄填寫當天體重數據');
      return;
    }

    if (!height) {
      showAlert('請至少填寫身高與體重以計算 BMI！');
      return;
    }
    if (!gender || !age) {
      showAlert('✨ BMI 指數已即時更新！(填寫完整的性別與年齡可進一步計算 BMR 與 TDEE)');
      return;
    }
    showAlert('✨ 指數已即時更新至最新狀態！');
  };

  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', multiplier: 1.2, label: 'BMR x 1.2' },
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', multiplier: 1.375, label: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', multiplier: 1.55, label: 'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', multiplier: 1.72, label: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', multiplier: 1.9, label: 'BMR x 1.9' },
  ];

  const getWebSelectStyle = (value: string, fieldKey: 'gender' | 'age' | 'height' | 'weight') => {
    const hasValue = value !== '';
    let textColor = '#E0E0E0'; 
    if (hasValue) {
      const isReallyChanged = value !== initialProfile?.[fieldKey]; 
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

  const hasBmiDisplay = metricsData.height !== '' && metricsData.weight !== '';
  const hasFullDisplay = metricsData.gender !== '' && metricsData.age !== '' && metricsData.height !== '' && metricsData.weight !== '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.metricsLayout}>
          
          <View style={styles.bmrSection}>
            <View style={styles.bmrCard}>
              <Text style={styles.bmrMainTitle}>基礎代謝率BMR</Text>
              
              <View style={styles.bmrList}>
                {/* 生生理性別 */}
                <View style={styles.bmrRow}>
                  <Text style={styles.bmrLabel}>生 理 性 別</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={metricsData.gender}
                      onChange={(e) => setMetricsData(prev => ({ ...prev, gender: e.target.value }))}
                      style={getWebSelectStyle(metricsData.gender, 'gender')}
                    >
                      {genderOptions.map(g => (
                        <option key={g} value={g} style={{ color: '#333333' }}>
                          {g === '' ? '請選擇性別' : g}
                        </option>
                      ))}
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
                  <Text style={styles.bmrLabel}>年       齡</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={metricsData.age}
                      onChange={(e) => {
                        if (e.target.value === '0') {
                          showAlert("請輸入大等於1的歲數，不滿1足歲無法計算TDEE");
                          setMetricsData(prev => ({ ...prev, age: '' }));
                          return;
                        }
                        setMetricsData(prev => ({ ...prev, age: e.target.value }));
                      }}
                      style={getWebSelectStyle(metricsData.age, 'age')}
                    >
                      {ageOptions.map(a => (
                        <option key={a} value={a} style={{ color: '#333333' }}>
                          {a === '' ? '請選擇年齡' : `${a} 歲`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={[styles.bmrInput, metricsData.age !== '' && (metricsData.age !== initialProfile?.age ? styles.darkValueText : styles.lightValueText)]}
                      value={metricsData.age}
                      placeholder="請輸入年齡"
                      placeholderTextColor="#E0E0E0"
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const cleanText = text.replace(/[^0-9]/g, '');
                        if (cleanText === '0') {
                          showAlert("請輸入大等於1的歲數，不滿1足歲無法計算TDEE");
                          setMetricsData(prev => ({ ...prev, age: '' }));
                          return;
                        }
                        setMetricsData(prev => ({ ...prev, age: cleanText }));
                      }}
                    />
                  )}
                </View>

                {/* 身高 */}
                <View style={styles.bmrRow}>
                  <Text style={styles.bmrLabel}>身       高</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={metricsData.height}
                      onChange={(e) => setMetricsData(prev => ({ ...prev, height: e.target.value }))}
                      style={getWebSelectStyle(metricsData.height, 'height')}
                    >
                      {heightOptions.map(h => (
                        <option key={h} value={h} style={{ color: '#333333' }}>
                          {h === '' ? '請選擇身高' : `${h} cm`}
                        </option>
                      ))}
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
                  <Text style={styles.bmrLabel}>體       重</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={metricsData.weight}
                      onChange={(e) => setMetricsData(prev => ({ ...prev, weight: e.target.value }))}
                      style={getWebSelectStyle(metricsData.weight, 'weight')}
                    >
                      {weightOptions.map(w => (
                        <option key={w} value={w} style={{ color: '#333333' }}>
                          {w === '' ? '四捨五入到整數' : `${w} kg`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={[styles.bmrInput, metricsData.weight !== '' && (metricsData.weight !== initialProfile?.weight ? styles.darkValueText : styles.lightValueText)]}
                      value={metricsData.weight}
                      placeholder="請輸入體重"
                      placeholderTextColor="#E0E0E0"
                      keyboardType="numeric"
                      onChangeText={(text) => setMetricsData(prev => ({ ...prev, weight: text }))}
                    />
                  )}
                </View>

                {/* BMI */}
                <View style={styles.bmrRow}>
                  <Text style={styles.bmrLabel}>B  M  I</Text>
                  <Text style={[styles.bmrValueText, hasBmiDisplay && styles.darkValueText]}>
                    {hasBmiDisplay ? metricsData.bmi : '---'} {(metricsData.bmiStatus && hasBmiDisplay) ? `(${metricsData.bmiStatus})` : ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>計算結果：</Text>
                <Text style={[styles.resultValue, (metricsData.isCalculated && hasFullDisplay) && styles.activeBmrText]}>
                  {(metricsData.isCalculated && hasFullDisplay) ? `${metricsData.bmrValue} kcal` : 'BMR'}
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.calculateButton} onPress={handleManualCalculate}>
                  <Text style={styles.calculateButtonText}>重新計算指數</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.calculateButton, { backgroundColor: '#1A91DA' }]} onPress={loadSyncProfileData}>
                  <Text style={styles.calculateButtonText}>同步會員資料</Text>
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

            <ScrollView style={styles.tdeeScrollArea} contentContainerStyle={styles.tdeeItemsContainer} showsVerticalScrollIndicator={false}>
              {tdeeItems.map((item) => {
                let finalTdeeValue = item.label;
                if (metricsData.isCalculated && hasFullDisplay) {
                  finalTdeeValue = `${Math.round(metricsData.bmrValue * item.multiplier)} kcal`;
                }

                return (
                  <View key={item.id} style={styles.tdeeItemBox}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activitySub}>{item.sub}</Text>
                    <Text style={styles.formulaText}>
                      {item.label} = <Text style={[styles.grayHighlight, (metricsData.isCalculated && hasFullDisplay) && styles.orangeHighlight]}>{finalTdeeValue}</Text>
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6EFE5' }, 
  content: { flex: 1, backgroundColor: '#F6EFE5', alignItems: 'center', justifyContent: 'center' },
  metricsLayout: { width: '90%', maxWidth: 1200, maxHeight: 680, flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', paddingVertical: 20 },
  bmrSection: { flex: 1, maxWidth: 460, marginRight: 25 },
  bmrCard: { backgroundColor: 'white', borderRadius: 35, paddingHorizontal: 40, paddingVertical: 35, elevation: 4 },
  bmrMainTitle: { fontSize: 32, fontWeight: 'bold', color: '#333333', textAlign: 'center', marginBottom: 30 },
  bmrList: { marginBottom: 15 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  bmrLabel: { fontSize: 20, fontWeight: '600', color: '#444', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }, 
  bmrInput: { fontSize: 18, textAlign: 'right', width: '140px', fontWeight: '500', padding: 0 },
  bmrValueText: { fontSize: 18, color: '#DCDCDC', fontWeight: '500', textAlign: 'right', width: '190px' }, 
  lightValueText: { color: '#999999', fontWeight: '600' }, 
  darkValueText: { color: '#333333', fontWeight: '600' },   
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 25, marginBottom: 25, justifyContent: 'center' },
  resultLabel: { fontSize: 24, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 32, color: '#DCDCDC', fontWeight: 'bold', marginLeft: 10 }, 
  activeBmrText: { color: '#E28743' },
  buttonContainer: { gap: 8 },
  calculateButton: { backgroundColor: '#E28743', borderRadius: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  calculateButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tdeeSection: { flex: 1, marginLeft: 25, display: 'flex', flexDirection: 'column' },
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#333', marginRight: 10 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  tdeeScrollArea: { flex: 1, width: '100%' },
  tdeeItemsContainer: { paddingBottom: 10 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 22, marginBottom: 16 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#333', textAlign: 'center' },
  grayHighlight: { color: '#DCDCDC', fontWeight: '500' }, 
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});