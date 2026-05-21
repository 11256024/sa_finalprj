import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 1. 全頁面配置物件
const pageLanguageConfig = {
  appName: '食半功倍',
  pageTitle: '新 增 / 刪 除 商 品',
  tabProductList: '商品列表',      
  tabAuditHistory: '審核紀錄',     
  subTabApproved: '您的已通過商品', 
  subTabRejected: '您的未通過商品', 
  addButtonText: '+ 新 增',
  searchPlaceholder: '🔍   輸 入 商 品 名 稱',
  searchCancel: '取 消',
  recentSearchLabel: '近 期 資 料', // 🌟 已修正：近期查詢 -> 近期資料
  calorieLabelPrefix: '熱量（',
  calorieLabelSuffix: ' 大卡）',
  deleteButtonText: '- 刪除',
  confirmDeleteButtonText: '確認並刪除', 
  emptyResultText: '找不到相關商品',
  
  // 警示框文字
  deleteAlertTitle: '是否刪除商品？',
  clearRejectedAlertTitle: '確認清除此筆未通過商品？', 
  cancelAddAlertTitle: '是否要取消商品？',
  alertWarningTitle: '提示',
  alertMissingFields: '請填寫完整的商品名稱、單位與熱量！',
  alertInvalidCalorie: '熱量請輸入正確的數字！',
  
  // 審核機制提示文字
  alertSubmitSuccessTitle: '商品已送出審核',
  alertSubmitSuccessMessage: '管理員審核通過後將會正式入庫供大眾搜尋。在此之前，您可以直接使用它來計算您的每日熱量！',
  
  // 狀態標籤文字
  statusPending: ' （審核中，可用於計算）', 

  // 警示對話框按鈕
  btnCancel: '取消',
  btnConfirm: '確定',
  btnNo: '否',
  btnYes: '是',

  // 正方形新增商品介面文字
  modalTitle: '新 增 商 品',
  labelName: '商 品 名 稱',
  labelUnit: '單 位',
  labelCalorie: '熱 量（ 大卡 ）',
  modalConfirm: '確 認',
  modalCancel: '取 消',
  namePlaceholder: '例如：御飯糰',
  caloriePlaceholder: '限輸入數字',
  amountPlaceholder: '限輸入數字'
};

const initialProducts = [
  { id: '1', name: '光泉 無糖豆漿 / 一瓶', calories: 120, status: 'approved' }, 
  { id: '2', name: '統一 低脂鮮乳 / 一盒', calories: 150, status: 'approved' }, 
  { id: '3', name: '茶葉蛋 / 一顆', calories: 75, status: 'approved' },  
];

export default function ProductsScreen() {
  const txt = pageLanguageConfig;

  // 分頁狀態控制
  const [activeTab, setActiveTab] = useState<'list' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'approved' | 'rejected'>('approved'); 

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]); 
  const [currentUserId, setCurrentUserId] = useState('guest'); 
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  const amountInputRef = useRef<TextInput>(null);
  const calorieInputRef = useRef<TextInput>(null);

  // 載入與拉取快取資料
  const loadSavedProducts = async () => {
    try {
      const savedUserId = await AsyncStorage.getItem('current_user_id') || 'guest';
      setCurrentUserId(savedUserId);
      
      let globalList = [];
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem('global_products');
        if (stored) {
          globalList = JSON.parse(stored);
        } else {
          localStorage.setItem('global_products', JSON.stringify(initialProducts));
          globalList = initialProducts;
        }
      } else {
        const stored = await AsyncStorage.getItem('global_products');
        globalList = stored ? JSON.parse(stored) : initialProducts;
      }

      setProducts([...globalList].reverse());
    } catch (e) {
      console.error('讀取商品快取失敗:', e);
    }
  };

  // 全域多視窗同步監聽
  useEffect(() => {
    loadSavedProducts();

    if (Platform.OS === 'web') {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'global_products') {
          loadSavedProducts();
        }
      };
      const handleWindowFocus = () => loadSavedProducts();

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleWindowFocus);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedProducts();
    }, [])
  );

  // 切換主分頁
  const handleTabChange = (tab: 'list' | 'audit') => {
    setActiveTab(tab);
    setSearchQuery(''); 
  };

  // 切換子分頁
  const handleSubTabChange = (subTab: 'approved' | 'rejected') => {
    setAuditSubTab(subTab);
    setSearchQuery('');
  };

  // 核心篩選過濾
  const getFilteredDisplayProducts = () => {
    let baseList = [];

    if (activeTab === 'list') {
      // 商品列表：全大眾已通過 + 自己審核中
      baseList = products.filter(item => {
        if (item.status === 'approved') return true;
        if (item.status === 'pending' && item.creatorId === currentUserId) return true;
        return false;
      });
    } else {
      // 審核紀錄
      if (auditSubTab === 'approved') {
        // 您的已通過商品
        baseList = products.filter(item => item.creatorId === currentUserId && item.status === 'approved');
      } else {
        // 您的未通過商品（管理者按下拒絕，狀態改為 rejected 的資料會完美顯示在這裡）
        baseList = products.filter(item => item.creatorId === currentUserId && item.status === 'rejected');
      }
    }

    if (searchQuery.trim() !== '') {
      baseList = baseList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return baseList;
  };

  const handleAmountChange = (text: string) => {
    setNewProductAmount(text.replace(/[^0-9]/g, ''));
  };

  const handleCalorieChange = (text: string) => {
    setNewProductCalorie(text.replace(/[^0-9]/g, ''));
  };

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean; title: string; message: string; onConfirm: () => void; cancelText?: string; confirmText?: string;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showCustomAlert = (title: string, message: string, onConfirm: () => void, cancelText = txt.btnCancel, confirmText = txt.btnConfirm) => {
    setCustomAlert({ visible: true, title, message, onConfirm, cancelText, confirmText });
  };

  const openAddModal = () => {
    setNewProductName(''); setNewProductAmount(''); setUnitType('g'); setNewProductCalorie('');
    setIsModalVisible(true);
  };

  const handleCancelAdd = () => {
    if (!newProductName.trim() && !newProductAmount.trim() && !newProductCalorie.trim()) {
      setIsModalVisible(false);
    } else {
      showCustomAlert(txt.cancelAddAlertTitle, '', () => { setIsModalVisible(false); }, txt.btnNo, txt.btnYes);
    }
  };

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

    const pendingProductItem = {
      id: `user_add_${Date.now()}`, 
      name: combinedName,
      unit: formattedUnit, 
      calories: calorieNum,
      status: 'pending',   
      creatorId: savedUserId 
    };

    setIsModalVisible(false);

    try {
      let currentGlobalProducts = [];
      if (Platform.OS === 'web') {
        const stored = localStorage.getItem('global_products');
        currentGlobalProducts = stored ? JSON.parse(stored) : [...initialProducts];
      } else {
        const stored = await AsyncStorage.getItem('global_products');
        currentGlobalProducts = stored ? JSON.parse(stored) : [...initialProducts];
      }

      currentGlobalProducts.push(pendingProductItem);

      if (Platform.OS === 'web') {
        localStorage.setItem('global_products', JSON.stringify(currentGlobalProducts));
      } else {
        await AsyncStorage.setItem('global_products', JSON.stringify(currentGlobalProducts));
      }

      loadSavedProducts();
    } catch (e) {
      console.error('儲存新商品資料失敗:', e);
    }

    setTimeout(() => {
      showCustomAlert(txt.alertSubmitSuccessTitle, txt.alertSubmitSuccessMessage, () => {}, '', txt.btnConfirm);
    } , 400);
  };

  const handleDeleteProduct = (id: string, name: string, isRejected: boolean) => {
    const alertTitle = isRejected ? txt.clearRejectedAlertTitle : txt.deleteAlertTitle;
    
    showCustomAlert(
      alertTitle,
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

          const filteredGlobal = currentGlobalProducts.filter(item => item.id !== id);

          if (Platform.OS === 'web') {
            localStorage.setItem('global_products', JSON.stringify(filteredGlobal));
          } else {
            await AsyncStorage.setItem('global_products', JSON.stringify(filteredGlobal));
          }

          loadSavedProducts();
        } catch (e) {
          console.error('刪除商品失敗:', e);
        }
      }
    );
  };

  const displayProducts = getFilteredDisplayProducts();

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          {/* 頂部標題與主分頁切換區 */}
          <View style={styles.cardHeader}>
            <View style={styles.titleTabRow}>
              <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
              
              {/* 主標籤：商品列表 */}
              <TouchableOpacity 
                style={[styles.mainTabButton, activeTab === 'list' && styles.mainTabButtonActive]}
                onPress={() => handleTabChange('list')}
              >
                <Text style={[styles.mainTabLabel, activeTab === 'list' && styles.mainTabLabelActive]}>
                  {txt.tabProductList}
                </Text>
              </TouchableOpacity>

              {/* 主標籤：審核紀錄 */}
              <TouchableOpacity 
                style={[styles.mainTabButton, activeTab === 'audit' && styles.mainTabButtonActive]}
                onPress={() => handleTabChange('audit')}
              >
                <Text style={[styles.mainTabLabel, activeTab === 'audit' && styles.mainTabLabelActive]}>
                  {txt.tabAuditHistory}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 🌟 已修正：只有在 activeTab === 'list' 時才顯示新增功能，審核紀錄時不顯示 */}
            {activeTab === 'list' && (
              <TouchableOpacity onPress={openAddModal}>
                <Text style={styles.addText}>{txt.addButtonText}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 內層分流切換鈕 */}
          {activeTab === 'audit' && (
            <View style={styles.subTabToggleContainer}>
              <TouchableOpacity 
                style={[styles.subTabItem, auditSubTab === 'approved' && styles.subTabItemActive]}
                onPress={() => handleSubTabChange('approved')}
              >
                <Text style={[styles.subTabLinkText, auditSubTab === 'approved' && styles.subTabLinkTextActive]}>
                  {txt.subTabApproved}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.subTabItem, auditSubTab === 'rejected' && styles.subTabItemActive]}
                onPress={() => handleSubTabChange('rejected')}
              >
                <Text style={[styles.subTabLinkText, auditSubTab === 'rejected' && styles.subTabLinkTextActive]}>
                  {txt.subTabRejected}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 🔍 滿版搜尋框 */}
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
              <TouchableOpacity style={styles.searchCancelButton} onPress={() => setSearchQuery('')}>
                <Text style={styles.searchCancelText}>{txt.searchCancel}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 🌟 文字已套用 txt.recentSearchLabel ("近期資料") */}
          <Text style={styles.recentText}>{txt.recentSearchLabel}</Text>

          {/* 📦 資料列表 */}
          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {displayProducts.map((item) => {
                const isMyOwnProduct = item.creatorId === currentUserId;
                const isRejected = item.status === 'rejected';

                return (
                  <View key={item.id} style={styles.productRow}>
                    
                    <View style={styles.nameAndStatusWrapper}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.name}
                        {activeTab === 'list' && isMyOwnProduct && item.status === 'pending' && (
                          <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                        )}
                      </Text>
                    </View>
                    
                    <Text style={styles.productCalorie}>
                      {txt.calorieLabelPrefix}{item.calories}{txt.calorieLabelSuffix}
                    </Text>
                    
                    {/* 按鈕樣式在未通過分頁自動替換為紅色確認 */}
                    <TouchableOpacity onPress={() => handleDeleteProduct(item.id, item.name, isRejected)}>
                      <Text style={isRejected ? styles.confirmDeleteText : styles.deleteText}>
                        {isRejected ? txt.confirmDeleteButtonText : txt.deleteButtonText}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {displayProducts.length === 0 && (
                <Text style={styles.emptyText}>{txt.emptyResultText}</Text>
              )}
            </ScrollView>
          </View>

        </View>
      </View>

      {/* 📦 新增商品彈窗 */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={handleCancelAdd}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={handleCancelAdd}>
          <TouchableOpacity activeOpacity={1} style={styles.squareModalContent}>
            <Text style={styles.orangeModalTitle}>{txt.modalTitle}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelName}</Text>
              <TextInput
                style={styles.underlineInput} value={newProductName} onChangeText={setNewProductName}
                placeholder={txt.namePlaceholder} placeholderTextColor="#A9A9A9" autoFocus={true}
                returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => amountInputRef.current?.focus()} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelUnit}</Text>
              <View style={styles.unitRowFlexContainer}>
                <TextInput
                  ref={amountInputRef} style={[styles.underlineInput, styles.amountInputInput]}
                  value={newProductAmount} onChangeText={handleAmountChange} keyboardType="numeric"
                  placeholder={txt.amountPlaceholder} placeholderTextColor="#A9A9A9" returnKeyType="next"
                  blurOnSubmit={false} onSubmitEditing={() => calorieInputRef.current?.focus()} 
                />
                <View style={styles.capsuleToggleGroup}>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.capsuleItem, unitType === 'g' && styles.capsuleItemActive]} onPress={() => setUnitType('g')}>
                    <Text style={[styles.capsuleText, unitType === 'g' && styles.capsuleTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.capsuleItem, unitType === 'ml' && styles.capsuleItemActive]} onPress={() => setUnitType('ml')}>
                    <Text style={[styles.capsuleText, unitType === 'ml' && styles.capsuleTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelCalorie}</Text>
              <TextInput
                ref={calorieInputRef} style={styles.underlineInput} value={newProductCalorie}
                onChangeText={handleCalorieChange} keyboardType="numeric" placeholder={txt.caloriePlaceholder}
                placeholderTextColor="#A9A9A9" returnKeyType="done" onSubmitEditing={handleConfirmAdd} 
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

      {/* 💡 通用確認提示對話框 */}
      <Modal animationType="fade" transparent={true} visible={customAlert.visible} onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            {customAlert.message ? <Text style={styles.alertMessage}>{customAlert.message}</Text> : null}
            <View style={styles.modalButtonGroup}>
              {customAlert.cancelText && (
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
                  <Text style={styles.modalBtnCancelText}>{customAlert.cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={() => { customAlert.onConfirm(); setCustomAlert(prev => ({ ...prev, visible: false })); }}>
                <Text style={styles.modalBtnConfirmText}>{customAlert.confirmText}</Text>
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
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 30, paddingBottom: 20 },
  cardContainer: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingTop: 35, paddingBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  
  titleTabRow: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 2, marginRight: 30 },
  mainTabButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, marginRight: 10 },
  mainTabButtonActive: { backgroundColor: '#95B09B' },
  mainTabLabel: { fontSize: 16, color: '#666', fontWeight: '600' },
  mainTabLabelActive: { color: '#FFF' },
  addText: { fontSize: 16, color: '#4A90E2', fontWeight: 'bold' },

  subTabToggleContainer: { flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 5 },
  subTabItem: { paddingVertical: 8, paddingHorizontal: 20, marginRight: 15, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  subTabItemActive: { borderBottomColor: '#FFAA77' },
  subTabLinkText: { fontSize: 15, color: '#888', fontWeight: '500' },
  subTabLinkTextActive: { color: '#FFAA77', fontWeight: 'bold' },
  
  searchRowContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, width: '100%' },
  searchBoxWrapper: { flex: 1, backgroundColor: '#EBEBEB', borderRadius: 25, paddingHorizontal: 20, height: 46, justifyContent: 'center', overflow: 'hidden' },
  searchInput: { 
    fontSize: 15, color: '#333', width: '100%', height: '100%', paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
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
  confirmDeleteText: { flex: 0.9, fontSize: 14, color: '#C0392B', fontWeight: 'bold', textAlign: 'right' }, 

  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  squareModalContent: { 
    backgroundColor: '#FFDDBB', width: 440, height: 440, paddingHorizontal: 40, justifyContent: 'center', borderRadius: 24, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 
  },
  orangeModalTitle: { fontSize: 26, fontWeight: 'bold', color: '#000', letterSpacing: 3, textAlign: 'center', marginBottom: 25 },
  inputGroup: { marginBottom: 20, width: '100%' },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 5 },
  underlineInput: { borderBottomWidth: 1, borderBottomColor: '#666', fontSize: 15, color: '#333', height: 35, paddingVertical: 0, paddingHorizontal: 2, width: '100%' },
  unitRowFlexContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  amountInputInput: { flex: 1, marginRight: 25 },
  capsuleToggleGroup: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#9EBAA4', borderRadius: 8, overflow: 'hidden', height: 34, width: 105, backgroundColor: '#FFF' },
  capsuleItem: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  capsuleItemActive: { backgroundColor: '#95B09B' },
  capsuleText: { fontSize: 14, color: '#95B09B', fontWeight: '700' },
  capsuleTextActive: { color: '#FFF' },
  orangeRowButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingHorizontal: 10 },
  orangeCancelBtn: { backgroundColor: '#EAEAEA', borderWidth: 1.5, borderColor: '#000', width: '45%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  orangeCancelBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  orangeConfirmBtn: { backgroundColor: '#FFAA77', borderWidth: 1.5, borderColor: '#000', width: '45%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
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