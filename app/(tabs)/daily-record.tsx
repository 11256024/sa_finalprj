import { useRouter, usePathname } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 定義單一食物項目的資料結構
interface FoodItem {
  id: string;
  name: string;      // 品項 / 單位 (例如: 御飯糰/60克)
  calories: string;  // 熱量
}

export default function DailyRecordScreen() {
  const router = useRouter();
  const pathname = usePathname(); // 🔄 動態偵測網址路徑，確保高亮底線 100% 精準

  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('—');

  // 👤 模擬從 profile 撈出來的會員頭像路徑 (未來換成真實的後端圖片網址即可)
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // 宣告 useRef 用來控制右邊單位欄位的焦點
  const unitInputRef = useRef<TextInput>(null);

  // 控制【核心新增飲食彈窗】顯示狀態
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 控制【警告/提示防呆彈窗】
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // 控制【二次確認防呆彈窗】
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  // 飲食輸入暫存狀態
  const [currentBlockCategory, setCurrentBlockCategory] = useState<'早餐' | '午餐' | '晚餐'>('早餐');
  const [inputItemName, setInputItemName] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [inputCalories, setInputCalories] = useState('');

  // 三個獨立的餐點區塊資料
  const [mealBlocks, setMealBlocks] = useState<{
    早餐: FoodItem[];
    午餐: FoodItem[];
    晚餐: FoodItem[];
  }>({
    早餐: [{ id: 'b1', name: '', calories: '' }], 
    午餐: [{ id: 'l1', name: '', calories: '' }], 
    晚餐: [{ id: 'd1', name: '', calories: '' }], 
  });

  // 定義橫幅選單的名稱與路由對照表
  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // 🎯 動態計算全天熱量總和
  const calculateTotalCalories = () => {
    let total = 0;
    Object.values(mealBlocks).forEach((foods) => {
      foods.forEach((item) => {
        const cal = parseInt(item.calories, 10);
        if (!isNaN(cal)) {
          total += cal;
        }
      });
    });
    return total;
  };

  // 體重與 BMI 換算
  const handleWeightChange = (text: string) => {
    setWeight(text);
    const w = parseFloat(text);
    if (!isNaN(w) && w > 0) {
      const h = 1.75; // 預設身高
      const bmiCalc = (w / (h * h)).toFixed(1);
      setBmi(bmiCalc);
    } else {
      setBmi('—');
    }
  };

  // 區塊內輸入框即時修改
  const handleInlineChange = (category: '早餐' | '午餐' | '晚餐', id: string, field: 'name' | 'calories', value: string) => {
    setMealBlocks(prev => ({
      ...prev,
      [category]: prev[category].map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  // 點擊區塊「+ 新增品項」按鈕
  const openAddModalForCategory = (category: '早餐' | '午餐' | '晚餐') => {
    setCurrentBlockCategory(category);
    setAddModalVisible(true);
  };

  // 觸發警告彈窗
  const showAlert = (message: string) => {
    setAlertMessage(message);
    setAlertModalVisible(true);
  };

  // 觸發詢問確認彈窗
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmModalVisible(true);
  };

  // 確認新增核心邏輯與防呆驗證
  const handleConfirmAddItem = () => {
    const trimmedItemName = inputItemName.trim();
    const trimmedUnit = inputUnit.trim();
    const trimmedCalories = inputCalories.trim();

    if (!trimmedItemName && !trimmedUnit) {
      showAlert(`請填寫${currentBlockCategory}的「品項」、「單位」與「熱量」！`);
      return;
    }
    if (!trimmedItemName) {
      showAlert(`⚠️ 欄位未填寫完整\n您只輸入了單位，請在斜線 (/) 左側補上品項名稱（例如：御飯糰）。`);
      return;
    }
    if (!trimmedUnit) {
      showAlert(`⚠️ 欄位未填寫完整\n您只輸入了品項，請在斜線 (/) 右側補上計算單位（例如：60克 或 1個）。`);
      return;
    }
    if (!trimmedCalories) {
      showAlert(`請為您輸入的${currentBlockCategory}補上「熱量(大卡)」數值！`);
      return;
    }

    showConfirm(
      '確認新增',
      `您確定要新增這筆${currentBlockCategory}紀錄嗎？`,
      () => {
        const finalFullName = `${trimmedItemName}/${trimmedUnit}`;
        const newItem: FoodItem = {
          id: Date.now().toString(),
          name: finalFullName,
          calories: trimmedCalories,
        };

        setMealBlocks(prev => {
          const currentBlock = prev[currentBlockCategory];
          if (currentBlock.length === 1 && currentBlock[0].name === '' && currentBlock[0].calories === '') {
            return { ...prev, [currentBlockCategory]: [newItem] };
          }
          return { ...prev, [currentBlockCategory]: [...currentBlock, newItem] };
        });

        setInputItemName('');
        setInputUnit('');
        setInputCalories('');
        setAddModalVisible(false);
      }
    );
  };

  // 取消按鈕點擊後的防呆流程
  const handleCancelAddItem = () => {
    if (inputItemName.trim() !== '' || inputUnit.trim() !== '' || inputCalories.trim() !== '') {
      showConfirm(
        '放棄編輯',
        `您輸入的${currentBlockCategory}內容尚未儲存，確定要取消並關閉視窗嗎？`,
        () => {
          setInputItemName('');
          setInputUnit('');
          setInputCalories('');
          setAddModalVisible(false);
        }
      );
    } else {
      setInputItemName('');
      setInputUnit('');
      setInputCalories('');
      setAddModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {menuItems.map((item) => {
              // 🎯 全功能高亮底線判斷：
              // 精準比對路由，或者是「每日紀錄」且目前正在根路由、daily-record 或 weightpic 圖表頁
              const isActive = 
                pathname === item.path || 
                (item.name === '每日紀錄' && (pathname === '/' || pathname.includes('daily-record') || pathname.includes('weightpic')));
              
              return (
                <TouchableOpacity key={item.name} onPress={() => router.push(item.path as any)} style={styles.menuButton}>
                  <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 👤 右上角：升級為圓形大頭貼按鈕 */}
        <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')}>
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
          ) : (
            // 預設大頭貼：無圖片時顯示高質感圓形純文字頭像
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>林</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 主內容區 */}
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordCard}>
          <View style={styles.titleRow}>
            <Text style={styles.mainTitle}>每日紀錄</Text>
            <TouchableOpacity onPress={() => router.push('/weightpic')}>
              <Text style={styles.linkText}>點我看體重紀錄</Text>
            </TouchableOpacity>
          </View>

          {/* 體重與 BMI 區塊 */}
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
            </View>
          </View>

          {/* 三大餐點區塊（早餐、午餐、晚餐） - 🔍 這裡已經修正乾淨！ */}
          {(['早餐', '午餐', '晚餐'] as const).map((category) => (
            <View key={category} style={styles.mealBlockCard}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockCategoryTitle}>{category}</Text>
                <TouchableOpacity style={styles.blockAddBtn} onPress={() => openAddModalForCategory(category)}>
                  <Text style={styles.blockAddBtnText}>+ 新增品項</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.thLabel, { flex: 3, textAlign: 'left' }]}>品項 / 單位</Text>
                <Text style={[styles.thLabel, { flex: 1, textAlign: 'right' }]}>熱量 (大卡)</Text>
              </View>

              {mealBlocks[category].map((food) => (
                <View key={food.id} style={styles.tableRow}>
                  <TextInput 
                    style={[styles.tableInput, { flex: 3 }]} 
                    placeholder={`請輸入${category}品項`} 
                    placeholderTextColor="#BBB" 
                    value={food.name}
                    onChangeText={(text) => handleInlineChange(category, food.id, 'name', text)}
                  />
                  <TextInput 
                    style={[styles.tableInput, { flex: 1, textAlign: 'right' }]} 
                    placeholder="0" 
                    placeholderTextColor="#BBB" 
                    keyboardType="numeric" 
                    value={food.calories}
                    onChangeText={(text) => handleInlineChange(category, food.id, 'calories', text)}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* 全天熱量總和 */}
          <View style={styles.totalCaloriesCard}>
            <Text style={styles.totalCaloriesLabel}>今日攝取總熱量</Text>
            <View style={styles.totalCaloriesValueGroup}>
              <Text style={styles.totalCaloriesNumber}>{calculateTotalCalories()}</Text>
              <Text style={styles.totalCaloriesUnit}> 大卡</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* ==================== 彈窗一：飲食輸入視窗 (Modal) ==================== */}
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
              <Text style={styles.inputLabel}>品項 / 單位</Text>
              <View style={styles.splitInputContainer}>
                <TextInput 
                  style={[styles.splitInput, { flex: 1.3 }]} 
                  placeholder={currentBlockCategory === '早餐' ? '例如：御飯糰' : currentBlockCategory === '午餐' ? '例如：雞肉便當' : '例如：烤鮭魚'} 
                  placeholderTextColor="#A9A9A9"
                  value={inputItemName}
                  onChangeText={setInputItemName}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => unitInputRef.current?.focus()}
                />
                <Text style={styles.splitDivider}>/</Text>
                <TextInput 
                  ref={unitInputRef}
                  style={[styles.splitInput, { flex: 0.8 }]} 
                  placeholder="單位請用克或ｍｌ" 
                  placeholderTextColor="#A9A9A9"
                  value={inputUnit}
                  onChangeText={setInputUnit}
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmAddItem}
                />
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
                onSubmitEditing={handleConfirmAddItem}
              />
            </View>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={handleCancelAddItem}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleConfirmAddItem}>
                <Text style={styles.modalBtnConfirmText}>確認新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== 彈窗二：自訂警告提示彈窗 (Modal) ==================== */}
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

      {/* ==================== 彈窗三：自訂雙向確認防呆彈窗 (Modal) ==================== */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>{confirmTitle}</Text>
            <Text style={styles.alertPopupMessage}>{confirmMessage}</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.orangeAlertBtn]} 
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
  header: {
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8, paddingBottom: 4 },
  
  // 🎯 白線底線高亮樣式
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  
  // 👤 大頭貼圓形樣式
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' },
  
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  recordCard: { backgroundColor: 'white', width: '65%', minWidth: 650, borderRadius: 40, padding: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
  mainTitle: { fontSize: 36, fontWeight: 'bold', color: '#333' },
  linkText: { fontSize: 20, color: '#F3B07E', fontWeight: '600' },
  
  weightSection: { marginBottom: 25 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 22, fontWeight: '600', color: '#444' },
  input: { width: '40%', fontSize: 20, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#CCC', paddingVertical: 4, color: '#333', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  bmiRow: { alignItems: 'flex-end' },
  bmiValue: { fontSize: 20, color: '#888', fontWeight: '500' },
  
  mealBlockCard: { backgroundColor: '#FCFCF9', borderWidth: 1, borderColor: '#EDEEEA', borderRadius: 20, padding: 25, marginBottom: 30 },
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  blockCategoryTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50' },
  blockAddBtn: { backgroundColor: '#A3C1AD', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 10 },
  blockAddBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },

  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 6 },
  thLabel: { fontSize: 18, fontWeight: '600', color: '#7F8C8D' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tableInput: { fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#EBEBEB', paddingVertical: 4, color: '#333', paddingHorizontal: 6, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },

  totalCaloriesCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF2E6', borderWidth: 1, borderColor: '#F3B07E', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 30, marginTop: 10 },
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
  
  splitInputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, backgroundColor: '#FAFAFA', paddingHorizontal: 10 },
  splitInput: { paddingVertical: 10, fontSize: 16, color: '#333', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  splitDivider: { fontSize: 20, color: '#BBB', fontWeight: '400', paddingHorizontal: 8 },
  popupInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },

  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 15 },
  modalBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 16, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#E67E22' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  alertPopupBox: { backgroundColor: '#FFF', width: 360, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertPopupTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  alertPopupMessage: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 25, paddingHorizontal: 10 },
  alertSingleBtn: { backgroundColor: '#A3C1AD', width: '100%', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertSingleBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});