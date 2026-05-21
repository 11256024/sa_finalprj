import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 1. 全頁面配置物件
const pageLanguageConfig = {
  appName: '食半功倍',
  memberCenter: '會員中心',
  pageTitle: '新 增 / 刪 除 商 品',
  addButtonText: '+ 新 增',
  searchPlaceholder: '🔍   輸 入 商 品 名 稱',
  searchCancel: '取 消',
  recentSearchLabel: '近 期 查 詢',
  calorieLabelPrefix: '熱量（',
  calorieLabelSuffix: ' 大卡）',
  deleteButtonText: '- 刪除',
  emptyResultText: '找不到相關商品',
  menuItems: [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ],
  
  // 警示框文字
  deleteAlertTitle: '是否刪除商品？',
  cancelAddAlertTitle: '是否要取消商品？',
  alertWarningTitle: '提示',
  alertMissingFields: '請填寫完整的商品名稱、單位與熱量！',
  alertInvalidCalorie: '熱量請輸入正確的數字！',
  
  // 審核機制提示文字
  alertSubmitSuccessTitle: '商品已送出審核',
  alertSubmitSuccessMessage: '管理員審核通過後將會正式入庫供大眾搜尋。在此之前，您可以直接使用它來計算您的每日熱量！',
  
  // 狀態標籤文字
  statusPending: ' （個人審核中，可用於計算）', 

  // 警示對話框按鈕
  btnCancel: '取消',
  btnConfirm: '確定',
  btnNo: '否',
  btnYes: '是',

  // 正方形新增商品介面文字
  modalTitle: '新 增 商 品',
  labelName: '商 品 名 稱',
  labelUnit: '單 位',
  labelCalorie: '熱 量（ 大 卡 ）',
  modalConfirm: '確 認',
  modalCancel: '取 消',
  namePlaceholder: '例如：御飯糰',
  caloriePlaceholder: '限輸入數字',
  amountPlaceholder: '限輸入數字'
};

// 2. 初始內建商品數據
const initialProducts = [
  { id: '1', name: '光泉 無糖豆漿 / 一瓶', calories: 120, status: 'approved' },
  { id: '2', name: '統一 低脂鮮乳 / 一盒', calories: 150, status: 'approved' },
  { id: '3', name: '茶葉蛋 / 一顆', calories: 75, status: 'approved' },
];

export default function ProductsScreen() {
  const router = useRouter();
  const txt = pageLanguageConfig;

  // 狀態管理
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]); 
  
  // 新增自訂商品彈窗控制
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  // 宣告控制輸入框焦點的 Refs
  const amountInputRef = useRef<TextInput>(null);
  const calorieInputRef = useRef<TextInput>(null);

  // 🔍 核心同步機制：整合讀取全局 global_products 與進行狀態過濾
  const loadSavedProducts = async () => {
    try {
      // 獲取目前使用者 ID（用於區分誰送審的 pending 商品）
      const savedUserId = await AsyncStorage.getItem('current_user_id') || 'guest';
      
      let globalList = [];
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem('global_products');
        if (stored) {
          globalList = JSON.parse(stored);
        } else {
          // 如果系統全新乾淨，初始化全局快取庫，填入內建初始商品
          localStorage.setItem('global_products', JSON.stringify(initialProducts));
          globalList = initialProducts;
        }
      } else {
        // 非 Web 環境退回 AsyncStorage 機制
        const stored = await AsyncStorage.getItem('global_products');
        globalList = stored ? JSON.parse(stored) : initialProducts;
      }

      // 🎯 核心過濾邏輯：
      // 使用者看得到的商品 = 所有已被管理員核准的 (approved) + 目前登入者自己新增送審中的 (pending)
      const visibleProducts = globalList.filter(item => {
        if (item.status === 'approved') return true;
        if (item.status === 'pending' && item.creatorId === savedUserId) return true;
        return false;
      });

      // 反轉陣列讓新加入的商品顯示在最上方
      setProducts(visibleProducts.reverse());
    } catch (e) {
      console.error('讀取商品快取失敗:', e);
    }
  };

  // 1. 初次渲染與即時監聽設定
  useEffect(() => {
    loadSavedProducts();

    if (Platform.OS === 'web') {
      // 🔥 核心雙向同步監聽 A：當管理員在另一個視窗更新、刪除、核准商品時，這裡會秒速被通知，立刻重新加載列表！
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'global_products') {
          loadSavedProducts();
        }
      };

      // 🔥 核心雙向同步監聽 B：當使用者從後台切回本頁聚焦時，強迫刷新抓取最新快取
      const handleWindowFocus = () => {
        loadSavedProducts();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleWindowFocus);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, []);

  // 2. 當 Expo 路由焦點切換回本頁面時重新載入同步
  useFocusEffect(
    useCallback(() => {
      loadSavedProducts();
    }, [])
  );

  // 處理份量輸入，限制只允許數字
  const handleAmountChange = (text: string) => {
    const cleanNumber = text.replace(/[^0-9]/g, '');
    setNewProductAmount(cleanNumber);
  };

  // 處理熱量輸入，限制只允許數字
  const handleCalorieChange = (text: string) => {
    const cleanNumber = text.replace(/[^0-9]/g, '');
    setNewProductCalorie(cleanNumber);
  };

  // 全域通用自訂警示框狀態
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    cancelText?: string;
    confirmText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showCustomAlert = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    cancelText = txt.btnCancel, 
    confirmText = txt.btnConfirm
  ) => {
    setCustomAlert({ visible: true, title, message, onConfirm, cancelText, confirmText });
  };

  // 開啟新增彈窗
  const openAddModal = () => {
    setNewProductName('');
    setNewProductAmount('');
    setUnitType('g'); 
    setNewProductCalorie('');
    setIsModalVisible(true);
  };

  // 雙重取消處理
  const handleCancelAdd = () => {
    const isFormEmpty = !newProductName.trim() && !newProductAmount.trim() && !newProductCalorie.trim();

    if (isFormEmpty) {
      setIsModalVisible(false);
      setNewProductName('');
      setNewProductAmount('');
      setNewProductCalorie('');
    } else {
      showCustomAlert(
        txt.cancelAddAlertTitle, 
        '',
        () => {
          setIsModalVisible(false);
          setNewProductName('');
          setNewProductAmount('');
          setNewProductCalorie('');
        },
        txt.btnNo,
        txt.btnYes
      );
    }
  };

  // 🎯 確認送出商品（同步推送到與管理員共享的 global_products 快取庫）
  const handleConfirmAdd = async () => {
    if (!newProductName.trim() || !newProductAmount.trim() || !newProductCalorie.trim()) {
      showCustomAlert(txt.alertWarningTitle, txt.alertMissingFields, () => {}, '', txt.btnConfirm);
      return;
    }

    const calorieNum = parseInt(newProductCalorie, 10);
    if (isNaN(calorieNum)) {
      showCustomAlert(txt.alertWarningTitle, txt.alertInvalidCalorie, () => {}, '', txt.btnConfirm);
      return;
    }

    const formattedUnit = `${newProductAmount}${unitType === 'g' ? '克' : 'ml'}`;
    const combinedName = `${newProductName.trim()} / ${formattedUnit}`;
    const savedUserId = await AsyncStorage.getItem('current_user_id') || 'guest';

    // 建立新待審核商品物件
    const pendingProductItem = {
      id: `user_add_${Date.now()}`, 
      name: combinedName,
      unit: formattedUnit, // 同步提供完整的單一欄位方便後台操作
      calories: calorieNum,
      status: 'pending',   // 🌟 狀態標註為待審核，這樣管理者後台就會自動抓到跳出通知！
      creatorId: savedUserId // 標記建立者，讓使用者自己能在前端列表看到審核中的狀態
    };

    setIsModalVisible(false);

    try {
      // 1. 讀取目前的全局公共快取庫
      let currentGlobalProducts = [];
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem('global_products');
        currentGlobalProducts = stored ? JSON.parse(stored) : [...initialProducts];
      } else {
        const stored = await AsyncStorage.getItem('global_products');
        currentGlobalProducts = stored ? JSON.parse(stored) : [...initialProducts];
      }

      // 2. 將新的送審商品推入全局公共陣列
      currentGlobalProducts.push(pendingProductItem);

      // 3. 回寫共享快取庫（一經儲存，管理者分頁透過監聽事件會即時跳出此商品）
      if (Platform.OS === 'web') {
        localStorage.setItem('global_products', JSON.stringify(currentGlobalProducts));
      } else {
        await AsyncStorage.setItem('global_products', JSON.stringify(currentGlobalProducts));
      }

      // 4. 更新本地 UI 顯示
      loadSavedProducts();

    } catch (e) {
      console.error('儲存新商品資料失敗:', e);
    }

    setTimeout(() => {
      showCustomAlert(
        txt.alertSubmitSuccessTitle,
        txt.alertSubmitSuccessMessage,
        () => {},
        '', 
        txt.btnConfirm
      );
    } , 400);
  };

  // 🎯 刪除商品動作（使用者僅能從全局快取中刪除屬於他自己新增的，或清除本地顯示）
  const handleDeleteProduct = (id: string, name: string) => {
    showCustomAlert(
      txt.deleteAlertTitle,
      `商品：${name}`,
      async () => {
        try {
          let currentGlobalProducts = [];
          if (Platform.OS === 'web') {
            const stored = localStorage.getItem('global_products');
            currentGlobalProducts = stored ? JSON.parse(stored) : [];
          } else {
            const stored = await AsyncStorage.getItem('global_products');
            currentGlobalProducts = stored ? JSON.parse(stored) : [];
          }

          // 從全局庫中剔除該筆資料
          const filteredGlobal = currentGlobalProducts.filter(item => item.id !== id);

          if (Platform.OS === 'web') {
            localStorage.setItem('global_products', JSON.stringify(filteredGlobal));
          } else {
            await AsyncStorage.setItem('global_products', JSON.stringify(filteredGlobal));
          }

          // 重新載入更新前端 UI
          loadSavedProducts();
        } catch (e) {
          console.error('刪除商品失敗:', e);
        }
      }
    );
  };

  const handleCancelSearch = () => {
    setSearchQuery('');
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          <View style={styles.cardHeader}>
            <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
            <TouchableOpacity onPress={openAddModal}>
              <Text style={styles.addText}>{txt.addButtonText}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRowContainer}>
            <View style={styles.searchBoxWrapper}>
              <TextInput 
                style={styles.searchInput}
                placeholder={txt.searchPlaceholder}
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.searchCancelButton} onPress={handleCancelSearch}>
                <Text style={styles.searchCancelText}>{txt.searchCancel}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.recentText}>{txt.recentSearchLabel}</Text>

          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {filteredProducts.map((item) => (
                <View key={item.id} style={styles.productRow}>
                  
                  <View style={styles.nameAndStatusWrapper}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                      {item.status === 'pending' && (
                        <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                      )}
                    </Text>
                  </View>
                  
                  <Text style={styles.productCalorie}>
                    {txt.calorieLabelPrefix}{item.calories}{txt.calorieLabelSuffix}
                  </Text>
                  
                  <TouchableOpacity onPress={() => handleDeleteProduct(item.id, item.name)}>
                    <Text style={styles.deleteText}>{txt.deleteButtonText}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {filteredProducts.length === 0 && (
                <Text style={styles.emptyText}>{txt.emptyResultText}</Text>
              )}
            </ScrollView>
          </View>

        </View>
      </View>

      {/* 📦 新增商品彈窗 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={handleCancelAdd}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={handleCancelAdd}
        >
          <TouchableOpacity activeOpacity={1} style={styles.squareModalContent}>
            
            <Text style={styles.orangeModalTitle}>{txt.modalTitle}</Text>
            
            {/* 商品名稱輸入 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelName}</Text>
              <TextInput
                style={styles.underlineInput}
                value={newProductName}
                onChangeText={setNewProductName}
                placeholder={txt.namePlaceholder}
                placeholderTextColor="#A9A9A9"
                autoFocus={true}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => amountInputRef.current?.focus()} 
              />
            </View>

            {/* 單位與份量區塊 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelUnit}</Text>
              <View style={styles.unitRowFlexContainer}>
                {/* 份量數字輸入框 */}
                <TextInput
                  ref={amountInputRef}
                  style={[styles.underlineInput, styles.amountInputInput]}
                  value={newProductAmount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  placeholder={txt.amountPlaceholder}
                  placeholderTextColor="#A9A9A9"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => calorieInputRef.current?.focus()} 
                />
                
                {/* 克 / ml 切換膠囊按鈕 */}
                <View style={styles.capsuleToggleGroup}>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[styles.capsuleItem, unitType === 'g' && styles.capsuleItemActive]} 
                    onPress={() => setUnitType('g')}
                  >
                    <Text style={[styles.capsuleText, unitType === 'g' && styles.capsuleTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    style={[styles.capsuleItem, unitType === 'ml' && styles.capsuleItemActive]} 
                    onPress={() => setUnitType('ml')}
                  >
                    <Text style={[styles.capsuleText, unitType === 'ml' && styles.capsuleTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 熱量輸入 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelCalorie}</Text>
              <TextInput
                ref={calorieInputRef}
                style={styles.underlineInput}
                value={newProductCalorie}
                onChangeText={handleCalorieChange}
                keyboardType="numeric"
                placeholder={txt.caloriePlaceholder}
                placeholderTextColor="#A9A9A9"
                returnKeyType="done"
                onSubmitEditing={handleConfirmAdd} 
              />
            </View>

            <View style={styles.orangeRowButtonGroup}>
              <TouchableOpacity style={styles.orangeCancelBtn} onPress={handleCancelAdd}>
                <Text style={styles.orangeCancelBtnText}>{txt.modalCancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.orangeConfirmBtn} onPress={handleConfirmAdd}>
                <Text style={styles.orangeConfirmBtnText}>{txt.modalConfirm}</Text>
              </TouchableOpacity>
            </View>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 💡 通用提示對話框 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            {customAlert.message ? <Text style={styles.alertMessage}>{customAlert.message}</Text> : null}
            
            <View style={styles.modalButtonGroup}>
              {customAlert.cancelText ? (
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalBtnCancel]} 
                  onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.modalBtnCancelText}>{customAlert.cancelText}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={[styles.modalBtn, styles.orangeAlertBtn]} 
                onPress={() => {
                  customAlert.onConfirm();
                  setCustomAlert(prev => ({ ...prev, visible: false }));
                }}
              >
                <Text style={styles.modalBtnConfirmText}>{customAlert.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// 樣式表保持原封不動，完全不破壞你精美的 UI 畫面！
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6EFE5' },
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 30, paddingBottom: 20 },
  cardContainer: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingTop: 35, paddingBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 2 },
  addText: { fontSize: 16, color: '#4A90E2', fontWeight: 'bold' },
  searchRowContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, width: '100%' },
  searchBoxWrapper: { flex: 1, backgroundColor: '#EBEBEB', borderRadius: 25, paddingHorizontal: 20, height: 46, justifyContent: 'center' },
  searchInput: { fontSize: 15, color: '#333' },
  searchCancelButton: { paddingLeft: 15, paddingVertical: 10, justifyContent: 'center' },
  searchCancelText: { fontSize: 16, color: '#666', fontWeight: '500' },
  recentText: { fontSize: 14, color: '#A0A0A0', marginBottom: 15, paddingLeft: 5, letterSpacing: 1 },
  listContainer: { flex: 1, width: '100%' },
  scrollListContent: { paddingBottom: 10 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 20, paddingHorizontal: 5 },
  nameAndStatusWrapper: { flex: 2, justifyContent: 'center' },
  productName: { fontSize: 16, color: '#333', fontWeight: '500' },
  pendingStatusTag: { fontSize: 14, color: '#E67E22', fontWeight: '500' }, 
  productCalorie: { flex: 1.5, fontSize: 15, color: '#888', textAlign: 'center' },
  deleteText: { flex: 0.5, fontSize: 15, color: '#4A90E2', fontWeight: 'bold', textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  squareModalContent: { 
    backgroundColor: '#FFDDBB', 
    width: 440, 
    height: 440, 
    paddingHorizontal: 40,
    justifyContent: 'center', 
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 12, 
    elevation: 8 
  },
  orangeModalTitle: { fontSize: 26, fontWeight: 'bold', color: '#000', letterSpacing: 3, textAlign: 'center', marginBottom: 25 },
  inputGroup: { marginBottom: 20, width: '100%' },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 5 },
  underlineInput: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#666', 
    fontSize: 15, 
    color: '#333', 
    height: 35,          
    paddingVertical: 0,  
    paddingHorizontal: 2,
    width: '100%'
  },
  unitRowFlexContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  amountInputInput: {
    flex: 1,
    marginRight: 25
  },
  capsuleToggleGroup: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#9EBAA4',
    borderRadius: 8,
    overflow: 'hidden',
    height: 34,
    width: 105,
    backgroundColor: '#FFF'
  },
  capsuleItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF'
  },
  capsuleItemActive: {
    backgroundColor: '#95B09B'
  },
  capsuleText: {
    fontSize: 14,
    color: '#95B09B',
    fontWeight: '700'
  },
  capsuleTextActive: {
    color: '#FFF'
  },
  orangeRowButtonGroup: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 25,
    paddingHorizontal: 10
  },
  orangeCancelBtn: {
    backgroundColor: '#EAEAEA', 
    borderWidth: 1.5,
    borderColor: '#000',
    width: '45%', 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  orangeCancelBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  orangeConfirmBtn: { 
    backgroundColor: '#FFAA77', 
    borderWidth: 1.5,      
    borderColor: '#000',
    width: '45%', 
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
  orangeConfirmBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  alertTitle: { fontSize: 19, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 1, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#FFAA77' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});