import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 定義單一食物項目的資料結構
interface FoodItem {
  id: string;
  name: string;      // 品項 / 單位 (例如: 御飯糰/60克)
  calories: string;  // 熱量
}

export default function DailyRecordScreen() {
  const router = useRouter();
  const pathname = usePathname(); 

  // ==================== 📅 台灣時間自動切換核心狀態 ====================
  const getTaiwanDateString = () => {
    const now = new Date();
    const twTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
    const year = twTime.getFullYear();
    const month = String(twTime.getMonth() + 1).padStart(2, '0');
    const day = String(twTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
  };

  const [currentDate, setCurrentDate] = useState<string>(getTaiwanDateString());

  // ==================== 📊 健康指數與彈窗狀態 ====================
  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('—');
  const [bmiStatus, setBmiStatus] = useState(''); 

  const [userHeight, setUserHeight] = useState<number | null>(175); 

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

  // 使用 useRef 保持最新狀態，供跨夜計時器背景存檔使用
  const stateRef = useRef({ weight, bmi, bmiStatus, mealBlocks, currentDate });
  useEffect(() => {
    stateRef.current = { weight, bmi, bmiStatus, mealBlocks, currentDate };
  }, [weight, bmi, bmiStatus, mealBlocks, currentDate]);

  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // ==================== 🔄 核心生命週期 ====================
  useEffect(() => {
    loadDataByDate(currentDate);

    // 每 10 秒自動檢查一次是否跨夜
    const interval = setInterval(async () => {
      const latestDateStr = getTaiwanDateString();
      
      if (latestDateStr !== stateRef.current.currentDate) {
        console.log(`[跨夜自動存檔] 日期變更: ${stateRef.current.currentDate} -> ${latestDateStr}`);
        
        // 跨夜存檔
        try {
          const oldDataToSave = {
            weight: stateRef.current.weight,
            bmi: stateRef.current.bmi,
            bmiStatus: stateRef.current.bmiStatus,
            mealBlocks: stateRef.current.mealBlocks
          };
          await AsyncStorage.setItem(`food_record_${stateRef.current.currentDate}`, JSON.stringify(oldDataToSave));
        } catch (err) {
          console.error("跨夜自動存檔失敗", err);
        }

        // 更新日期核心狀態並重置/載入新畫面
        setCurrentDate(latestDateStr);
        await loadDataByDate(latestDateStr);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentDate, pathname]);

  // 從 AsyncStorage 讀取指定日期資料
  const loadDataByDate = async (dateStr: string) => {
    try {
      const savedDataStr = await AsyncStorage.getItem(`food_record_${dateStr}`);
      if (savedDataStr) {
        const parsed = JSON.parse(savedDataStr);
        setWeight(parsed.weight || '');
        setBmi(parsed.bmi || '—');
        setBmiStatus(parsed.bmiStatus || '');
        setMealBlocks(parsed.mealBlocks || { 早餐: [], 午餐: [], 晚餐: [] });
      } else {
        setWeight('');
        setBmi('—');
        setBmiStatus('');
        setMealBlocks({ 早餐: [], 午餐: [], 晚餐: [] });
      }
    } catch (e) {
      console.error('載入本機快取失敗', e);
    }
  };

  // 通用儲存至 AsyncStorage 的方法
  const saveDataToStorage = async (
    currentWeight: string, 
    currentBmi: string, 
    currentBmiStatus: string, 
    currentMeals: typeof mealBlocks
  ) => {
    try {
      const dataToSave = {
        weight: currentWeight,
        bmi: currentBmi,
        bmiStatus: currentBmiStatus,
        mealBlocks: currentMeals
      };
      await AsyncStorage.setItem(`food_record_${currentDate}`, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('同步至快取失敗', e);
    }
  };

  // ==================== 🧮 體重與 BMI 計算 ====================
  const getBmiStatusLabel = (bmiValue: number) => {
    if (bmiValue < 18.5) return '體重過輕';
    if (bmiValue >= 18.5 && bmiValue < 24) return '健康體重';
    if (bmiValue >= 24 && bmiValue < 27) return '體重過重';
    return '肥胖';
  };

  const getBmiColor = (status: string) => {
    return status === '健康體重' ? '#2ECC71' : status === '體重過輕' ? '#F1C40F' : '#E74C3C';
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    let calculatedBmi = '—';
    let calculatedStatus = '';

    const w = parseFloat(text);
    if (!isNaN(w) && w > 0 && userHeight && userHeight > 0) {
      const hInMeters = userHeight / 100;
      calculatedBmi = (w / (hInMeters * hInMeters)).toFixed(1);
      calculatedStatus = getBmiStatusLabel(parseFloat(calculatedBmi));
      setBmi(calculatedBmi);
      setBmiStatus(calculatedStatus);
    } else {
      setBmi('—');
      setBmiStatus('');
    }

    saveDataToStorage(text, calculatedBmi, calculatedStatus, mealBlocks);
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

  // ==================== 🎯 核心飲食增刪 ====================
  const handleDeleteItem = (category: '早餐' | '午餐' | '晚餐', id: string, name: string) => {
    const displayFoodName = name.trim() !== '' ? name : '未命名品項';
    
    showConfirm(
      '確認刪除',
      `您確定要刪除這筆「${displayFoodName}」的紀錄嗎？`,
      () => {
        const updatedMeals = {
          ...mealBlocks,
          [category]: mealBlocks[category].filter(item => item.id !== id)
        };
        setMealBlocks(updatedMeals);
        saveDataToStorage(weight, bmi, bmiStatus, updatedMeals);
      }
    );
  };

  const handleConfirmAddItem = () => {
    const trimmedItemName = inputItemName.trim();
    const trimmedUnitValue = inputUnitValue.trim();
    const trimmedCalories = inputCalories.trim();

    if (!trimmedItemName || !trimmedUnitValue || !trimmedCalories) {
      showAlert(`⚠️ 欄位未填寫完整\n請輸入完整的品項、份量數值與熱量。`);
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
      showConfirm(
        '確認取消',
        '您確定要取消新增嗎？先前輸入的內容將不會被儲存。',
        () => {
          resetModalInputs();
          setAddModalVisible(false);
        }
      );
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

  // 斜線格式化器 (顯示用)
  const formatDisplayDate = (dateStr: string) => {
    return dateStr.replace(/-/g, '/');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.name === '每日紀錄' && (pathname === '/' || pathname.includes('daily-record')));
              return (
                <TouchableOpacity key={item.name} onPress={() => router.push(item.path as any)} style={styles.menuButton}>
                  <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')}>
          <View style={styles.defaultAvatar}><Text style={styles.defaultAvatarText}>林</Text></View>
        </TouchableOpacity>
      </View>

      {/* 主內容區 */}
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordCard}>
          
          <View style={styles.titleRow}>
            <View style={styles.titleWithDateGroup}>
              <Text style={styles.mainTitle}>每日紀錄</Text>
              <Text style={styles.todayDateText}>{formatDisplayDate(currentDate)}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/weightpic')}>
              <Text style={styles.linkText}>點我看體重紀錄</Text>
            </TouchableOpacity>
          </View>

          {/* 今日體重 */}
          <View style={styles.weightSection}>
            <View style={styles.weightInputRow}>
              <Text style={styles.label}>今日體重</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入體重"
                placeholderTextColor="#A9A9A9"
                value={weight}
                keyboardType="numeric"
                onChangeText={handleWeightChange}
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

          {/* 三大餐點區塊 */}
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
                  <Text style={[styles.thLabel, { flex: 3, textAlign: 'left' }]}>品項 / 單位</Text>
                  <Text style={[styles.thLabel, { flex: 1, textAlign: 'right', marginRight: 65 }]}>熱量 (大卡)</Text>
                </View>
              )}

              {mealBlocks[category].map((food) => (
                <View key={food.id} style={styles.tableRow}>
                  <View style={[styles.readOnlyTextWrapper, { flex: 3 }]}>
                    <Text style={styles.tableTextContent}>{food.name}</Text>
                  </View>
                  <View style={[styles.readOnlyTextWrapper, { flex: 1, alignItems: 'flex-end', marginRight: 15 }]}>
                    <Text style={styles.tableTextContent}>{food.calories}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.deleteRowTextBtn} 
                    onPress={() => handleDeleteItem(category, food.id, food.name)}
                  >
                    <Text style={styles.deleteRowText}>刪除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}

          {/* 今日攝取總熱量 */}
          <View style={styles.totalCaloriesCard}>
            <Text style={styles.totalCaloriesLabel}>今日攝取總熱量</Text>
            <View style={styles.totalCaloriesValueGroup}>
              <Text style={styles.totalCaloriesNumber}>{calculateTotalCalories()}</Text>
              <Text style={styles.totalCaloriesUnit}> 大卡</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* ==================== 彈窗：新增飲食紀錄 (Modal) ==================== */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={handleCancelAddItem}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>新增飲食紀錄</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新增類別</Text>
              <View style={styles.disabledSelectBox}>
                <Text style={styles.disabledSelectText}>{currentBlockCategory}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>品項名稱</Text>
              <TextInput 
                style={styles.popupInput} 
                placeholder="例如：御飯糰" 
                placeholderTextColor="#A9A9A9"
                value={inputItemName}
                onChangeText={setInputItemName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>份量與單位</Text>
              <View style={styles.unitSelectorContainer}>
                <TextInput 
                  style={styles.unitNumberInput} 
                  placeholder="例如：60" 
                  placeholderTextColor="#A9A9A9"
                  keyboardType="numeric"
                  value={inputUnitValue}
                  onChangeText={setInputUnitValue}
                />
                
                <View style={styles.toggleButtonGroup}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, selectedUnitType === '克' && styles.toggleBtnActive]} 
                    onPress={() => setSelectedUnitType('克')}
                  >
                    <Text style={[styles.toggleBtnText, selectedUnitType === '克' && styles.toggleBtnTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, selectedUnitType === 'ml' && styles.toggleBtnActive]} 
                    onPress={() => setSelectedUnitType('ml')}
                  >
                    <Text style={[styles.toggleBtnText, selectedUnitType === 'ml' && styles.toggleBtnTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>熱 量 (大卡)</Text>
              <TextInput 
                style={styles.popupInput} 
                placeholder="例如：350" 
                placeholderTextColor="#A9A9A9"
                keyboardType="numeric"
                value={inputCalories}
                onChangeText={setInputCalories}
              />
            </View>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalButton, styles.modalBtnCancel]} onPress={handleCancelAddItem}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.orangeAlertBtn]} onPress={handleConfirmAddItem}>
                <Text style={styles.modalBtnConfirmText}>確認新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== 彈窗二：提示視窗 ==================== */}
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

      {/* ==================== 彈窗三：確認防呆彈窗 ==================== */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>{confirmTitle}</Text>
            <Text style={styles.alertPopupMessage}>{confirmMessage}</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalButton, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.orangeAlertBtn]} 
                onPress={() => {
                  setConfirmModalVisible(false);
                  confirmAction();
                }}
              >
                <Text style={styles.modalBtnConfirmText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } }) },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' },
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
  thLabel: { fontSize: 18, fontWeight: '600', color: '#7F8C8D' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  readOnlyTextWrapper: { paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
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
  popupInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  unitSelectorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitNumberInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA', marginRight: 15, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  toggleButtonGroup: { flexDirection: 'row', borderWidth: 1, borderColor: '#A3C1AD', borderRadius: 10, overflow: 'hidden', height: 44, width: 120 },
  toggleBtn: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#A3C1AD' },
  toggleBtnText: { fontSize: 15, color: '#A3C1AD', fontWeight: '600' },
  toggleBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 15 },
  modalButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#333' },
  modalBtnCancelText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  orangeAlertBtn: { backgroundColor: '#E67E22' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  alertPopupBox: { backgroundColor: '#FFF', width: 360, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertPopupTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  alertPopupMessage: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 25 },
  alertSingleBtn: { backgroundColor: '#A3C1AD', width: '100%', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertSingleBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});