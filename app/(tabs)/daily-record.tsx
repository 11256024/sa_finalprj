import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface FoodItem {
  id: string;
  name: string;      
  calories: string;  
}

export default function DailyRecordScreen() {
  const router = useRouter();
  const pathname = usePathname(); 

  const [userId, setUserId] = useState<string>('guest'); 

  const getTaiwanDateString = () => {
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

  const [currentDate, setCurrentDate] = useState<string>(getTaiwanDateString());
  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('—');
  const [bmiStatus, setBmiStatus] = useState(''); 
  const [userHeight, setUserHeight] = useState<number | null>(null); 

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  const [currentBlockCategory, setCurrentBlockCategory] = useState<'早餐' | '午餐' | '晚餐'>('早餐');
  const [inputItemName, setInputItemName] = useState('');
  const [inputUnitValue, setInputUnitValue] = useState(''); 
  const [selectedUnitType, setSelectedUnitType] = useState<'克' | 'ml'>('克'); 
  const [inputCalories, setInputCalories] = useState('');

  const [mealBlocks, setMealBlocks] = useState<{
    早餐: FoodItem[];
    午餐: FoodItem[];
    晚餐: FoodItem[];
  }>({
    早餐: [], 
    午餐: [], 
    晚餐: [], 
  });

  const stateRef = useRef({ weight, bmi, bmiStatus, mealBlocks, currentDate, userId });
  useEffect(() => {
    stateRef.current = { weight, bmi, bmiStatus, mealBlocks, currentDate, userId };
  }, [weight, bmi, bmiStatus, mealBlocks, currentDate, userId]);

  useEffect(() => {
    const initUserAndLoad = async () => {
      try {
        const savedUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';

        const finalId = savedUserId;
        setUserId(finalId);
        
        const todayStr = getTaiwanDateString();
        setCurrentDate(todayStr);

        const memberHeight = await loadMemberHeight(finalId);
        await loadDataByDate(todayStr, finalId, memberHeight);
      } catch (e) {
        console.error('初始化失敗', e);
        const todayStr = getTaiwanDateString();
        await loadDataByDate(todayStr, 'guest');
      }
    };
    initUserAndLoad();
  }, [pathname]);

  const loadDataByDate = async (dateStr: string, currentUid: string = userId, heightForBmi: number | null = userHeight) => {
  try {
    const savedDataStr = await AsyncStorage.getItem(`${currentUid}_food_record_${dateStr}`);

    if (savedDataStr) {
      const parsed = JSON.parse(savedDataStr);

      if (parsed.hasDailyWeight === true) {
        const savedWeight = parsed.weight || '';
        const bmiResult = calculateBmiByHeight(savedWeight, heightForBmi);

        setWeight(savedWeight);
        setBmi(bmiResult.calculatedBmi);
        setBmiStatus(bmiResult.calculatedStatus);

        // 用會員中心最新身高重新產生 BMI，不回寫會員體重。
        await saveDataToStorage(
          savedWeight,
          bmiResult.calculatedBmi,
          bmiResult.calculatedStatus,
          parsed.mealBlocks || { 早餐: [], 午餐: [], 晚餐: [] }
        );
      } else {
        setWeight('');
        setBmi('—');
        setBmiStatus('');
      }

      setMealBlocks(parsed.mealBlocks || { 早餐: [], 午餐: [], 晚餐: [] });
    } else {
      setWeight('');
      setBmi('—');
      setBmiStatus('');
      setMealBlocks({ 早餐: [], 午餐: [], 晚餐: [] });
    }
  } catch (e) {
    console.error('載入失敗', e);
  }
};

  const saveDataToStorage = async (
  currentWeight: string, 
  currentBmi: string, 
  currentBmiStatus: string, 
  currentMeals: typeof mealBlocks
) => {
  try {
    const hasDailyWeight = currentWeight.trim() !== '';

    const dataToSave = {
      weight: currentWeight,
      bmi: currentBmi,
      bmiStatus: currentBmiStatus,
      mealBlocks: currentMeals,
      hasDailyWeight: hasDailyWeight,
    };

    await AsyncStorage.setItem(
      `${userId}_food_record_${currentDate}`,
      JSON.stringify(dataToSave)
    );

  } catch (e) {
    console.error('同步失敗', e);
  }
};

  const getBmiStatusLabel = (bmiValue: number) => {
    if (bmiValue < 18.5) return '體重過輕';
    if (bmiValue >= 18.5 && bmiValue < 24) return '健康體重';
    if (bmiValue >= 24 && bmiValue < 27) return '體重過重';
    return '肥胖';
  };

  const getBmiColor = (status: string) => {
    return status === '健康體重' ? '#2ECC71' : status === '體重過輕' ? '#F1C40F' : '#E74C3C';
  };

  const loadMemberHeight = async (currentUid: string) => {
    try {
      let heightValue = '';

      const profileRaw = await AsyncStorage.getItem(`${currentUid}_user_profile`);
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (profile?.height) {
          heightValue = profile.height.toString();
        }
      }

      if (!heightValue) {
        heightValue =
          (await AsyncStorage.getItem(`${currentUid}_user_height`)) ||
          (await AsyncStorage.getItem(`${currentUid}_height`)) ||
          '';
      }

      const parsedHeight = parseFloat(heightValue);

      if (!isNaN(parsedHeight) && parsedHeight > 0) {
        setUserHeight(parsedHeight);
        return parsedHeight;
      }

      setUserHeight(null);
      return null;
    } catch (e) {
      console.error('讀取會員中心身高失敗', e);
      setUserHeight(null);
      return null;
    }
  };

  const calculateBmiByHeight = (inputWeight: string, heightForBmi: number | null) => {
    let calculatedBmi = '—';
    let calculatedStatus = '';

    const w = parseFloat(inputWeight);

    if (!isNaN(w) && w > 0 && heightForBmi && heightForBmi > 0) {
      const hInMeters = heightForBmi / 100;
      calculatedBmi = (w / (hInMeters * hInMeters)).toFixed(1);
      calculatedStatus = getBmiStatusLabel(parseFloat(calculatedBmi));
    }

    return { calculatedBmi, calculatedStatus };
  };

  const handleWeightChange = (text: string) => {
    let cleanedText = text.replace(/[^0-9.]/g, '');
    const parts = cleanedText.split('.');
    if (parts.length > 2) cleanedText = `${parts[0]}.${parts.slice(1).join('')}`;
    setWeight(cleanedText);

    const { calculatedBmi, calculatedStatus } = calculateBmiByHeight(cleanedText, userHeight);

    setBmi(calculatedBmi);
    setBmiStatus(calculatedStatus);
    saveDataToStorage(cleanedText, calculatedBmi, calculatedStatus, mealBlocks);
  };

  const handleWeightBlur = () => {
    if (weight.trim() === '') {
      setWeight('');
      setBmi('—');
      setBmiStatus('');
      saveDataToStorage('', '—', '', mealBlocks);
      return;
    }
    const w = parseFloat(weight);
    let finalWeight = weight;

    if (isNaN(w)) {
      finalWeight = '';
      setWeight('');
      setBmi('—');
      setBmiStatus('');
    } else if (w < 30) {
      finalWeight = '30';
      setWeight('30');
      showAlert('⚠️ 體重輸入限制範圍為 30 ~ 200 KG\n已自動修正為：30 KG');
    } else if (w > 200) {
      finalWeight = '200';
      setWeight('200');
      showAlert('⚠️ 體重輸入限制範圍為 30 ~ 200 KG\n已自動修正為：200 KG');
    }

    const { calculatedBmi, calculatedStatus } = calculateBmiByHeight(finalWeight, userHeight);

    setBmi(calculatedBmi);
    setBmiStatus(calculatedStatus);

    saveDataToStorage(finalWeight, calculatedBmi, calculatedStatus, mealBlocks);
  };

  const calculateTotalCalories = () => {
    let total = 0;
    Object.values(mealBlocks).forEach((foods) => {
      foods.forEach((item) => {
        const cal = parseInt(item.calories, 10);
        if (!isNaN(cal)) total += cal;
      });
    });
    return total;
  };

  const handleDeleteItem = (category: '早餐' | '午餐' | '晚餐', id: string, name: string) => {
    showConfirm('確認刪除', `您確定要刪除「${name || '此品項'}」嗎？`, () => {
      const updatedMeals = {
        ...mealBlocks,
        [category]: mealBlocks[category].filter(item => item.id !== id)
      };
      setMealBlocks(updatedMeals);
      saveDataToStorage(weight, bmi, bmiStatus, updatedMeals);
    });
  };

  const handleConfirmAddItem = () => {
    const trimmedItemName = inputItemName.trim();
    const trimmedUnitValue = inputUnitValue.trim();
    const trimmedCalories = inputCalories.trim();

    if (!trimmedItemName || !trimmedUnitValue || !trimmedCalories) {
      showAlert('欄位未填寫完整\n請輸入完整的品項、份量數值與熱量。');
      return;
    }

    const finalFullName = `${trimmedItemName}/${trimmedUnitValue}${selectedUnitType}`;
    const newItem: FoodItem = {
      id: Date.now().toString(),
      name: finalFullName,
      calories: trimmedCalories,
    };

    const updatedMeals = {
      ...mealBlocks,
      [currentBlockCategory]: [...mealBlocks[currentBlockCategory], newItem]
    };

    setMealBlocks(updatedMeals);
    saveDataToStorage(weight, bmi, bmiStatus, updatedMeals);
    resetModalInputs();
    setAddModalVisible(false);
  };

  const handleCancelAddItem = () => {
    if (inputItemName.trim() !== '' || inputUnitValue.trim() !== '' || inputCalories.trim() !== '') {
      showConfirm('確認取消', '確定要取消新增嗎？內容將不會被儲存。', () => {
        resetModalInputs();
        setAddModalVisible(false);
      });
    } else {
      resetModalInputs();
      setAddModalVisible(false);
    }
  };

  const resetModalInputs = () => {
    setInputItemName('');
    setInputUnitValue('');
    setSelectedUnitType('克');
    setInputCalories('');
  };

  const openAddModalForCategory = (category: '早餐' | '午餐' | '晚餐') => {
    setCurrentBlockCategory(category);
    setAddModalVisible(true);
  };

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setAlertModalVisible(true);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmModalVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E0E7DA' }}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordCard}>
          
          <View style={styles.titleRow}>
            <View style={styles.titleWithDateGroup}>
              <Text style={styles.mainTitle}>每日紀錄</Text>
              <Text style={styles.todayDateText}>{currentDate.replace(/-/g, '/')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/weightpic')}>
              <Text style={styles.linkText}>點我看體重紀錄</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightSection}>
            <View style={styles.weightInputRow}>
              <Text style={styles.label}>今日體重</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入體重 (30~200 KG)"
                placeholderTextColor="#A9A9A9"
                value={weight}
                keyboardType="numeric"
                onChangeText={handleWeightChange}
                onBlur={handleWeightBlur}
              />
            </View>
            <View style={styles.bmiRow}>
              <Text style={styles.bmiValue}>BMI 值： {bmi}</Text>
              {bmiStatus ? (
                <View style={[styles.bmiStatusTag, { backgroundColor: getBmiColor(bmiStatus) }]}>
                  <Text style={styles.bmiStatusText}>{bmiStatus}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {(['早餐', '午餐', '晚餐'] as const).map((category) => (
            <View key={category} style={styles.mealBlockCard}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockCategoryTitle}>{category}</Text>
                <TouchableOpacity style={styles.blockAddBtn} onPress={() => openAddModalForCategory(category)}>
                  <Text style={styles.blockAddBtnText}>+ 新增品項</Text>
                </TouchableOpacity>
              </View>

              {mealBlocks[category].length > 0 && (
                <View style={styles.tableHeader}>
                  <Text style={[styles.thLabel, { flex: 3 }]}>品項 / 單位</Text>
                  <Text style={[styles.thLabel, { flex: 1, textAlign: 'right', marginRight: 65 }]}>熱量 (大卡)</Text>
                </View>
              )}

              {mealBlocks[category].map((food) => (
                <View key={food.id} style={styles.tableRow}>
                  <View style={{ flex: 3, paddingVertical: 6 }}>
                    <Text style={styles.tableTextContent}>{food.name}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 15 }}>
                    <Text style={styles.tableTextContent}>{food.calories}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteRowTextBtn} onPress={() => handleDeleteItem(category, food.id, food.name)}>
                    <Text style={styles.deleteRowText}>刪除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.totalCaloriesCard}>
            <Text style={styles.totalCaloriesLabel}>今日攝取總熱量</Text>
            <View style={styles.totalCaloriesValueGroup}>
              <Text style={styles.totalCaloriesNumber}>{calculateTotalCalories()}</Text>
              <Text style={styles.totalCaloriesUnit}> 大卡</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 新增飲食彈窗 */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={handleCancelAddItem}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>新增飲食紀錄</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新增類別</Text>
              <View style={styles.disabledSelectBox}><Text style={styles.disabledSelectText}>{currentBlockCategory}</Text></View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>品項名稱</Text>
              <TextInput style={styles.popupInput} placeholder="例如：御飯糰" placeholderTextColor="#A9A9A9" value={inputItemName} onChangeText={setInputItemName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>份量與單位</Text>
              <View style={styles.unitSelectorContainer}>
                <TextInput style={styles.unitNumberInput} placeholder="限輸入數字" placeholderTextColor="#A9A9A9" keyboardType="numeric" value={inputUnitValue} onChangeText={(text) => setInputUnitValue(text.replace(/[^0-9]/g, ''))} />
                <View style={styles.toggleButtonGroup}>
                  <TouchableOpacity style={[styles.toggleBtn, selectedUnitType === '克' && styles.toggleBtnActive]} onPress={() => setSelectedUnitType('克')}>
                    <Text style={[styles.toggleBtnText, selectedUnitType === '克' && styles.toggleBtnTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, selectedUnitType === 'ml' && styles.toggleBtnActive]} onPress={() => setSelectedUnitType('ml')}>
                    <Text style={[styles.toggleBtnText, selectedUnitType === 'ml' && styles.toggleBtnTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>熱 量 (大卡)</Text>
              <TextInput style={styles.popupInput} placeholder="限輸入數字" placeholderTextColor="#A9A9A9" keyboardType="numeric" value={inputCalories} onChangeText={(text) => setInputCalories(text.replace(/[^0-9]/g, ''))} />
            </View>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnLeft} onPress={handleCancelAddItem}>
                <Text style={styles.modalBtnLeftText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnRight} onPress={handleConfirmAddItem}>
                <Text style={styles.modalBtnRightText}>確認新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 提示與確認彈窗 */}
      <Modal animationType="fade" transparent={true} visible={alertModalVisible} onRequestClose={() => setAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>⚠️ 提示</Text>
            <Text style={styles.alertPopupMessage}>{alertMessage}</Text>
            <TouchableOpacity style={styles.alertSingleBtn} onPress={() => setAlertModalVisible(false)}>
              <Text style={styles.alertSingleBtnText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>{confirmTitle}</Text>
            <Text style={styles.alertPopupMessage}>{confirmMessage}</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnLeft} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalBtnLeftText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnRight} onPress={() => { setConfirmModalVisible(false); confirmAction(); }}>
                <Text style={styles.modalBtnRightText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  recordCard: { backgroundColor: 'white', width: '65%', minWidth: 650, borderRadius: 40, padding: 50 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
  titleWithDateGroup: { flexDirection: 'row', alignItems: 'baseline' },
  mainTitle: { fontSize: 36, fontWeight: 'bold', color: '#333' },
  todayDateText: { fontSize: 22, color: '#666', fontWeight: '600', marginLeft: 15 },
  linkText: { fontSize: 20, color: '#F3B07E', fontWeight: '600' },
  weightSection: { marginBottom: 25 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 22, fontWeight: '600', color: '#444' },
  input: { width: '40%', fontSize: 20, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#CCC', paddingVertical: 4 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5 },
  bmiValue: { fontSize: 20, color: '#888', fontWeight: '500', marginRight: 10 },
  bmiStatusTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  bmiStatusText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  mealBlockCard: { backgroundColor: '#FCFCF9', borderWidth: 1, borderColor: '#EDEEEA', borderRadius: 20, padding: 25, marginBottom: 30, minHeight: 90 },
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  blockCategoryTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50' },
  blockAddBtn: { backgroundColor: '#A3C1AD', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 10 },
  blockAddBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 6, marginBottom: 12 },
  thLabel: { fontSize: 18, fontWeight: '600', color: '#7F8C8D', textAlign: 'left' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tableTextContent: { fontSize: 18, color: '#333', fontWeight: '500' },
  deleteRowTextBtn: { paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10, backgroundColor: '#FADBD8', borderRadius: 8 },
  deleteRowText: { fontSize: 15, color: '#C0392B', fontWeight: 'bold' },
  totalCaloriesCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF2E6', borderWidth: 1, borderColor: '#F3B07E', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 30 },
  totalCaloriesLabel: { fontSize: 22, fontWeight: 'bold', color: '#D35400' },
  totalCaloriesValueGroup: { flexDirection: 'row', alignItems: 'baseline' },
  totalCaloriesNumber: { fontSize: 32, fontWeight: 'bold', color: '#E67E22' },
  totalCaloriesUnit: { fontSize: 18, fontWeight: '600', color: '#7F8C8D' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  popupBox: { backgroundColor: '#FFF', width: 460, padding: 35, borderRadius: 25 },
  popupTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 25, textAlign: 'center' },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#4A4A4A', marginBottom: 8 },
  disabledSelectBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EEEEEE' },
  disabledSelectText: { fontSize: 16, color: '#666', fontWeight: 'bold' },
  popupInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA' },
  unitSelectorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitNumberInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA', marginRight: 15 },
  toggleButtonGroup: { flexDirection: 'row', borderWidth: 1, borderColor: '#A3C1AD', borderRadius: 10, overflow: 'hidden', height: 44, width: 120 },
  toggleBtn: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#A3C1AD' },
  toggleBtnText: { fontSize: 15, color: '#A3C1AD', fontWeight: '600' },
  toggleBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 15 },
  modalBtnLeft: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#333' },
  modalBtnLeftText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  modalBtnRight: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6, backgroundColor: '#E67E22' },
  modalBtnRightText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  alertPopupBox: { backgroundColor: '#FFF', width: 360, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertPopupTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  alertPopupMessage: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 25 },
  alertSingleBtn: { backgroundColor: '#A3C1AD', width: '100%', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertSingleBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});