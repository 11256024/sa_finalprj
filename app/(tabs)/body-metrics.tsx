import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_URL = 'http://127.0.0.1:8001';

const parseApiResponse = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
  }
};

const getCurrentMemberId = async () => {
  try {
    const userStr = await AsyncStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;

    const memberId =
      currentUser?.id?.toString?.() ||
      (await AsyncStorage.getItem('current_user_id')) ||
      (await AsyncStorage.getItem('member_id')) ||
      'guest';

    return /^\d+$/.test(memberId) ? memberId : 'guest';
  } catch {
    return 'guest';
  }
};

const getAgeFromBirthday = (birthday: string) => {
  if (!birthday) return '';

  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? String(age) : '';
};

const cleanBackendNumberText = (value: any) => {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[^0-9.]/g, '').trim();
};

export default function BodyMetricsScreen() {

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

  // 🛠️ 客製化美化彈窗控制狀態
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: ''
  });

  // 📜 右側 TDEE 模擬捲動軸狀態管理
  const scrollRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(1);
  const [containerHeight, setContainerHeight] = useState(1);
  const [scrollY, setScrollY] = useState(0);

  // 讓右側自訂捲動條可以用滑鼠拖拉
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollYRef = useRef(0);

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
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.format(now).split('/');
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  };

  const showAlert = (message: string) => {
    setCustomAlert({
      visible: true,
      title: message, 
      message: ''     
    });
  };

  // 🔄 核心清洗與解析函式
  // 規則：性別、年齡、身高一律用會員中心；體重每日紀錄優先，沒有才用會員中心
  const parseAndCleanProfile = (
    userProfileRaw: string | null,
    dailyRecordWeight: string,
    scannedHeight: string,
    scannedWeight: string
  ) => {
    let savedProfile: any = null;

    if (userProfileRaw) {
      try {
        savedProfile = JSON.parse(userProfileRaw);
      } catch (e) {}
    }

    const cleanNumberString = (value: any) => {
      if (value === undefined || value === null) return '';
      const raw = value.toString().trim();
      if (!raw || raw.includes('請選擇')) return '';
      return raw.replace(/[^0-9.]/g, '').trim();
    };

    const cleanHeightValue = (value: any) => {
      const cleaned = cleanNumberString(value);
      const heightNum = parseFloat(cleaned);
      if (!cleaned || isNaN(heightNum) || heightNum < 100 || heightNum > 250) return '';
      return Math.round(heightNum).toString();
    };

    const cleanWeightValue = (value: any) => {
      const cleaned = cleanNumberString(value);
      const weightNum = parseFloat(cleaned);
      if (!cleaned || isNaN(weightNum) || weightNum < 30 || weightNum > 200) return '';
      return Math.round(weightNum).toString();
    };

    // 身高：一律優先使用會員中心資料，沒有才用目前使用者自己的身高快取
    const cleanHeight =
      cleanHeightValue(savedProfile?.height) ||
      cleanHeightValue(scannedHeight);

    // 體重：今日每日紀錄有輸入就優先用；沒有才用會員中心資料
    const cleanWeight =
      cleanWeightValue(dailyRecordWeight) ||
      cleanWeightValue(savedProfile?.weight) ||
      cleanWeightValue(scannedWeight);

    // 性別：一律用會員中心資料
    let rawGender = savedProfile?.gender || '';
    let cleanGender =
      rawGender === '請選擇性別' || !rawGender || rawGender.toString().includes('請選擇')
        ? ''
        : rawGender.toString().trim();

    // 年齡：一律用會員中心 birthday / age
    let finalAge = '';
    let isZeroAge = false;

    if (savedProfile?.age !== undefined && savedProfile?.age !== null && savedProfile?.age !== '') {
      finalAge = savedProfile.age.toString().replace(/[^0-9]/g, '').trim();
    } else if (savedProfile?.birthday && !savedProfile.birthday.toString().includes('請選擇')) {
      const birthDate = new Date(savedProfile.birthday);

      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        finalAge = age >= 0 ? age.toString() : '';
      }
    }

    if (finalAge === '0') {
      isZeroAge = true;
      finalAge = '';
    }

    return { cleanGender, finalAge, cleanHeight, cleanWeight, isZeroAge };
  };

  const loadProfileFromBackend = async (memberId: string) => {
    if (!memberId || memberId === 'guest') return null;

    try {
      const response = await fetch(`${API_URL}/members/${memberId}/profile/`);
      const data = await parseApiResponse(response);

      if (!response.ok || data.success === false || !data.member) {
        return null;
      }

      const member = data.member;
      const profileForCache = {
        gender: member.gender ? String(member.gender) : '',
        birthday: member.birthday ? String(member.birthday) : '',
        age: member.birthday ? getAgeFromBirthday(String(member.birthday)) : '',
        height: member.height !== null && member.height !== undefined ? cleanBackendNumberText(member.height) : '',
        weight: member.initial_weight !== null && member.initial_weight !== undefined ? cleanBackendNumberText(member.initial_weight) : '',
      };

      await AsyncStorage.setItem(`${memberId}_user_profile`, JSON.stringify(profileForCache));
      await AsyncStorage.setItem(`${memberId}_user_height`, profileForCache.height);
      await AsyncStorage.setItem(`${memberId}_user_weight`, profileForCache.weight);
      if (profileForCache.age) {
        await AsyncStorage.setItem(`${memberId}_user_age`, profileForCache.age);
      }

      return profileForCache;
    } catch (e) {
      console.log('從後端讀取會員資料失敗，改用本機快取', e);
      return null;
    }
  };

  const applyProfileToMetrics = async (showSuccessAlert = false) => {
    try {
      const savedUserId = await getCurrentMemberId();

      if (!savedUserId || savedUserId === 'guest') {
        if (showSuccessAlert) showAlert('⚠️ 找不到目前登入會員，請重新登入');
        return;
      }

      const backendProfile = await loadProfileFromBackend(savedUserId);

      const scannedHeight =
        await AsyncStorage.getItem(`${savedUserId}_user_height`) ||
        await AsyncStorage.getItem(`${savedUserId}_height`) ||
        '';

      let todayWeight = '';
      const todayFoodKey = `${savedUserId}_food_record_${getTodayDateString()}`;
      const dailyFoodRecordRaw = await AsyncStorage.getItem(todayFoodKey);

      if (dailyFoodRecordRaw) {
        try {
          const parsedFood = JSON.parse(dailyFoodRecordRaw);
          if (
            parsedFood.hasDailyWeight === true &&
            parsedFood.weight !== undefined &&
            parsedFood.weight !== null &&
            parsedFood.weight.toString().trim() !== ''
          ) {
            todayWeight = parsedFood.weight.toString().trim();
          }
        } catch (e) {}
      }

      const localData =
        backendProfile !== null
          ? JSON.stringify(backendProfile)
          : await AsyncStorage.getItem(`${savedUserId}_user_profile`);

      const scannedWeight = await AsyncStorage.getItem(`${savedUserId}_user_weight`) || '';

      const { cleanGender, finalAge, cleanHeight, cleanWeight, isZeroAge } =
        parseAndCleanProfile(localData, todayWeight, scannedHeight, scannedWeight);

      if (showSuccessAlert && (!cleanWeight || cleanWeight.trim() === '' || parseFloat(cleanWeight) === 0)) {
        showAlert('⚠️ 請先至會員中心或每日紀錄填寫體重資料');
        return;
      }

      if (showSuccessAlert && (!cleanGender || !finalAge || !cleanHeight)) {
        showAlert('⚠️ 請至會員中心填寫完整的性別、生日與身高資料');
        return;
      }

      if (isZeroAge) {
        if (showSuccessAlert) showAlert('請輸入大等於1的歲數，不滿1足歲無法計算TDEE');
        setInitialProfile({ gender: cleanGender, age: '', height: cleanHeight, weight: cleanWeight });
        setMetricsData(prev => ({
          ...prev,
          gender: cleanGender,
          age: '',
          height: cleanHeight,
          weight: cleanWeight,
          isCalculated: false,
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
        isCalculated: false,
      }));

      if (showSuccessAlert) {
        showAlert('✨ 指數與會員資料同步成功！');
      }
    } catch (error) {
      console.error('同步會員資料錯誤：', error);
      if (showSuccessAlert) showAlert('⚠️ 同步失敗，請確認 Django 是否已啟動');
    }
  };

  // 💥【自動化載入】焦點監聽：進入頁面時自動從 Django / Aiven 抓目前會員資料
  useFocusEffect(
    useCallback(() => {
      setScrollY(0);
      applyProfileToMetrics(false);
    }, [])
  );

  // 🔄 手動點擊「同步會員資料」按鈕邏輯
  const loadSyncProfileData = async () => {
    await applyProfileToMetrics(true);
  };

  // 📊 【即時更新】僅自動計算與監聽 BMI
  useEffect(() => {
    const { height, weight } = metricsData;

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

    // 只要有任何資料改動，BMR 與 TDEE 就重置為「未計算狀態」
    setMetricsData(prev => ({
      ...prev,
      bmi: currentBmi,
      bmiStatus: currentBmiStatus,
      isCalculated: false
    }));

  }, [metricsData.gender, metricsData.age, metricsData.height, metricsData.weight]);

  // 🎯 手動觸發熱量計算邏輯（點擊重新計算熱量時觸發）
  const handleManualCalculate = () => {
    const { gender, age, height, weight } = metricsData;
    
    if (!weight || weight.trim() === '' || parseFloat(weight) === 0) {
      showAlert('⚠️請先填寫完整資料才可以計算BMR與TDEE！\n');
      return;
    }

    if (!height) {
      showAlert('請至少填寫身高與體重以計算 BMI！');
      return;
    }

    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    const ageNum = parseInt(age);

    if (!gender || !age || isNaN(heightNum) || heightNum <= 0 || isNaN(weightNum) || weightNum <= 0 || isNaN(ageNum) || ageNum <= 0) {
      showAlert('✨ BMI 指數已即時更新！\n(填寫完整的性別與年齡可進一步計算 BMR 與 TDEE)');
      return;
    }

    // 執行 BMR 的實質公式計算
    let bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum;
    if (gender === '男') bmr += 5;
    else if (gender === '女') bmr -= 161;

    setMetricsData(prev => ({
      ...prev,
      bmrValue: Math.round(bmr),
      isCalculated: true
    }));

    showAlert('✨ 熱量已更新至最新狀態！');
  };

  const tdeeItems = [
    { id: '1', title: '身體活動趨於靜態', sub: '(幾乎不運動)', multiplier: 1.2, label: 'BMR x 1.2' },
    { id: '2', title: '身體活動程度較低', sub: '(每週運動 1-3 天)', multiplier: 1.375, label: 'BMR x 1.375' },
    { id: '3', title: '身體活動程度正常', sub: '(每週運動 3-5 天)', multiplier: 1.55, label: 'BMR x 1.55' },
    { id: '4', title: '身體活動程度較高', sub: '(每週運動 6-7 天)', multiplier: 1.72, label: 'BMR x 1.72' },
    { id: '5', title: '身體活動程度激烈', sub: '(長時間運動或體力勞動工作)', multiplier: 1.9, label: 'BMR x 1.9' },
  ];

  // 🎯 Web 專用純原生選單樣式
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
      width: 140,
      fontWeight: '500' as const,
      cursor: 'pointer',
    };
  };

  const hasBmiDisplay =
    metricsData.height !== '' &&
    metricsData.weight !== '' &&
    metricsData.bmi !== '---';

  const hasFullDisplay =
    metricsData.gender !== '' &&
    metricsData.age !== '' &&
    metricsData.height !== '' &&
    metricsData.weight !== '' &&
    metricsData.bmi !== '---';

  // 🧮 計算客製化捲動滑塊的位置與高度
  const scrollbarTrackHeight = Math.max(1, containerHeight - 40); // 扣除上下箭頭高度的軌道總長
  const scrollableHeight = Math.max(0, contentHeight - containerHeight);
  
  // 避免分母為 0
  const thumbHeight = Math.max(
    30, 
    scrollableHeight > 0 ? (containerHeight / contentHeight) * scrollbarTrackHeight : scrollbarTrackHeight
  );
  
  const thumbTop = scrollableHeight > 0 
    ? (scrollY / scrollableHeight) * (scrollbarTrackHeight - thumbHeight) 
    : 0;

  const getMouseY = (event: any) => {
    return (
      event?.nativeEvent?.clientY ??
      event?.clientY ??
      event?.nativeEvent?.pageY ??
      event?.pageY ??
      0
    );
  };

  const scrollToByScrollbar = (targetY: number) => {
    const maxScrollY = Math.max(0, scrollableHeight);
    const nextY = Math.max(0, Math.min(targetY, maxScrollY));

    scrollRef.current?.scrollTo({ y: nextY, animated: false });
    setScrollY(nextY);
  };

  const handleThumbMouseDown = (event: any) => {
    if (Platform.OS !== 'web') return;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    dragStartYRef.current = getMouseY(event);
    dragStartScrollYRef.current = scrollY;
    setIsDraggingScrollbar(true);
  };

  const handleTrackMouseDown = (event: any) => {
    if (Platform.OS !== 'web') return;

    event?.preventDefault?.();

    const mouseY = getMouseY(event);
    const rect = event?.currentTarget?.getBoundingClientRect?.();

    if (!rect) return;

    const clickY = mouseY - rect.top;
    const maxThumbTop = Math.max(1, scrollbarTrackHeight - thumbHeight);
    const targetThumbTop = Math.max(0, Math.min(clickY - thumbHeight / 2, maxThumbTop));
    const targetScrollY = (targetThumbTop / maxThumbTop) * scrollableHeight;

    scrollToByScrollbar(targetScrollY);

    dragStartYRef.current = mouseY;
    dragStartScrollYRef.current = targetScrollY;
    setIsDraggingScrollbar(true);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !isDraggingScrollbar) return;

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();

      const deltaY = event.clientY - dragStartYRef.current;
      const maxThumbTop = Math.max(1, scrollbarTrackHeight - thumbHeight);
      const nextScrollY =
        dragStartScrollYRef.current + (deltaY / maxThumbTop) * scrollableHeight;

      scrollToByScrollbar(nextScrollY);
    };

    const handleMouseUp = () => {
      setIsDraggingScrollbar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingScrollbar, scrollableHeight, scrollbarTrackHeight, thumbHeight]);

  // 監聽實際捲動事件
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

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
                  <Text style={styles.calculateButtonText}>計算熱量</Text>
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

            {/* 外層包覆：提供側邊客製化滾動軸擺放的排版空間 */}
            <View 
              style={styles.scrollWrapper}
              onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
            >
              <ScrollView 
                ref={scrollRef}
                style={styles.tdeeScrollArea} 
                contentContainerStyle={styles.tdeeItemsContainer} 
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleScroll}
                onContentSizeChange={(_, height) => setContentHeight(height)}
              >
                {tdeeItems.map((item) => {
                  const isCalculated = metricsData.isCalculated && hasFullDisplay;
                  const finalTdeeValue = isCalculated 
                    ? `${Math.round(metricsData.bmrValue * item.multiplier)} kcal`
                    : '';

                  return (
                    <View key={item.id} style={styles.tdeeItemBox}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activitySub}>{item.sub}</Text>
                      <Text style={styles.formulaText}>
                        {item.label} = {isCalculated ? <Text style={styles.orangeHighlight}>{finalTdeeValue}</Text> : ''}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* 🛠️ 客製化側邊滾動條元組 (依據截圖樣式繪製) */}
              <View style={styles.customScrollbarContainer}>
                {/* 上箭頭 */}
                <TouchableOpacity 
                  onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, scrollY - 80), animated: true })}
                  style={styles.arrowButton}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </TouchableOpacity>

                {/* 中間滾動軌道與滑塊：可用滑鼠拖拉 */}
                <View
                  style={[
                    styles.scrollbarTrack,
                    Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null
                  ]}
                  {...(Platform.OS === 'web' ? ({ onMouseDown: handleTrackMouseDown } as any) : {})}
                >
                  <View
                    style={[
                      styles.scrollbarThumb,
                      Platform.OS === 'web'
                        ? ({ cursor: isDraggingScrollbar ? 'grabbing' : 'grab' } as any)
                        : null,
                      {
                        height: thumbHeight,
                        transform: [{ translateY: thumbTop }]
                      }
                    ]}
                    {...(Platform.OS === 'web' ? ({ onMouseDown: handleThumbMouseDown } as any) : {})}
                  />
                </View>

                {/* 下箭頭 */}
                <TouchableOpacity 
                  onPress={() => scrollRef.current?.scrollTo({ y: Math.min(Math.max(0, contentHeight - containerHeight), scrollY + 80), animated: true })}
                  style={styles.arrowButton}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>

        </View>
      </View>

      {/* 客製化美化提示彈窗 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContentBox}>
            <Text style={styles.alertTitleText}>{customAlert.title}</Text>
            {customAlert.message !== '' && (
              <Text style={styles.alertMessageText}>{customAlert.message}</Text>
            )}
            <View style={styles.modalSingleButtonWrapper}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.alertConfirmActionBtn} 
                onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
              >
                <Text style={styles.alertConfirmActionBtnText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  bmrInput: { fontSize: 18, textAlign: 'right', width: 140, fontWeight: '500', padding: 0 },
  bmrValueText: { fontSize: 18, color: '#DCDCDC', fontWeight: '500', textAlign: 'right', width: 190 }, 
  lightValueText: { color: '#999999', fontWeight: '600' }, 
  darkValueText: { color: '#333333', fontWeight: '600' },   
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 25, marginBottom: 25, justifyContent: 'center' },
  resultLabel: { fontSize: 24, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 32, color: '#DCDCDC', fontWeight: 'bold', marginLeft: 10 }, 
  activeBmrText: { color: '#E28743' },
  buttonContainer: { gap: 8 },
  calculateButton: { backgroundColor: '#E28743', borderRadius: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  calculateButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  // TDEE 區排版
  tdeeSection: { flex: 1, marginLeft: 25, display: 'flex', flexDirection: 'column' },
  tdeeTitleBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 25, marginBottom: 16 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  tdeeTitle: { fontSize: 42, fontWeight: 'bold', color: '#333', marginRight: 10 },
  tdeeSubTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  tdeeDesc: { fontSize: 18, color: '#F3B07E', fontWeight: '500' },
  
  // 捲動區域容器
  scrollWrapper: { flex: 1, flexDirection: 'row', position: 'relative' },
  tdeeScrollArea: { flex: 1, marginRight: 24 }, // 右邊留白給捲動軸
  tdeeItemsContainer: { paddingBottom: 10 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 30, paddingHorizontal: 35, paddingVertical: 22, marginBottom: 16 },
  activityTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 6 },
  activitySub: { fontSize: 18, color: '#BBB', marginBottom: 14, textAlign: 'center' },
  formulaText: { fontSize: 24, color: '#333', textAlign: 'center' },
  grayHighlight: { color: '#DCDCDC', fontWeight: '500' }, 
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' },

  // 🛠️ 客製化捲動軸 UI 樣式系統
  customScrollbarContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 16,
    backgroundColor: '#F5F5F5', // 淺灰底色滑道
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#EAEAEA'
  },
  arrowButton: {
    width: 14,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 9,
    color: '#8E8E93',
    fontWeight: 'bold'
  },
  scrollbarTrack: {
    flex: 1,
    width: '100%',
    position: 'relative',
    marginVertical: 2,
  },
  scrollbarThumb: {
    position: 'absolute',
    width: 10,
    left: 2,
    backgroundColor: '#8E8E93', // 灰色的長條形滑塊
    borderRadius: 5,
  },

  // 彈窗樣式
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)',  
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  alertContentBox: { 
    backgroundColor: '#FFF',              
    width: 360,                                                                   
    paddingHorizontal: 25,
    paddingTop: 35, 
    paddingBottom: 25,
    borderRadius: 24,                     
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 12, 
    elevation: 8 
  },
  alertTitleText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 26, 
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 26
  },
  alertMessageText: { 
    fontSize: 16, 
    color: '#555', 
    lineHeight: 24, 
    marginBottom: 26, 
    textAlign: 'center',
    fontWeight: '500'
  },
  modalSingleButtonWrapper: { 
    width: '100%', 
    alignItems: 'center',
    paddingHorizontal: 15
  },
  alertConfirmActionBtn: { 
    backgroundColor: '#FFAA77',           
    borderWidth: 1.5,                     
    borderColor: '#000',
    width: '80%',                                                                
    height: 44, 
    borderRadius: 22,                     
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  alertConfirmActionBtnText: { 
    color: '#000',                        
    fontSize: 17, 
    fontWeight: 'bold', 
    letterSpacing: 2 
  }
});