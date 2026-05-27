import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://127.0.0.1:8001';

interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending' | 'rejected';
  creatorId?: string;
}

const parseApiResponse = async (response: any) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
  }
};

const mapProductFromApi = (item: any): Product => ({
  id: String(item.id),
  name: item.name || '',
  unit: item.unit || '',
  calories: Number(item.calories || 0),
  status: item.status || 'approved',
  creatorId: item.creator !== null && item.creator !== undefined
    ? String(item.creator)
    : (item.creator_id !== null && item.creator_id !== undefined ? String(item.creator_id) : ''),
});

// 全頁面配置物件
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
  recentSearchLabel: '近 期 資 料', 
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

export default function ProductsScreen() {
  const txt = pageLanguageConfig;

  // 分頁狀態控制
  const [activeTab, setActiveTab] = useState<'list' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'approved' | 'rejected'>('approved'); 

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]); 
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('guest'); 
  const lastFetchAtRef = useRef(0);
  const isFetchingRef = useRef(false);
  
  // 🎯 新增 Ref 來儲存最新的商品列表，避免在 useEffect 中直接監聽 products 導致無窮迴圈
  const productsRef = useRef<Product[]>([]);
  // 用來追蹤上一次有哪些商品在審核中，以便抓到狀態改變的瞬間
  const prevPendingIdsRef = useRef<string[]>([]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  const amountInputRef = useRef<TextInput>(null);
  const calorieInputRef = useRef<TextInput>(null);

  // 每次 products 狀態更新時，同步更新到 Ref 中
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // 自動格式化並串接前台顯示的「品名與單位」
  const formatDisplayInfo = (name: string, unit: string) => {
    let cleanName = name ? name.trim() : '';
    let cleanUnit = unit ? unit.trim() : '';

    if (cleanName.includes('/') || (cleanUnit && cleanName.includes(cleanUnit))) {
      const parts = cleanName.split('/');
      if (parts.length > 1) {
        cleanName = parts[0].trim();
      } else if (cleanUnit && cleanName.endsWith(cleanUnit)) {
        cleanName = cleanName.substring(0, cleanName.length - cleanUnit.length).trim();
      }
    }

    if (cleanUnit.includes('/')) {
      const unitParts = cleanUnit.split('/');
      if (unitParts[0].trim() === unitParts[1].trim()) {
        cleanUnit = unitParts[0].trim();
      }
    }

    return cleanUnit ? `${cleanName} / ${cleanUnit}` : cleanName;
  };

  const getCurrentMemberId = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const id =
        user?.id?.toString?.() ||
        (await AsyncStorage.getItem('current_user_id')) ||
        (await AsyncStorage.getItem('member_id')) ||
        '';

      return /^\d+$/.test(id) ? id : 'guest';
    } catch (error) {
      console.error('取得目前會員 ID 失敗:', error);
      return 'guest';
    }
  };

  const getProductCacheKey = (memberId: string) => `${memberId}_products_cache_v4`;

  const fetchProductsByUrl = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(data.message || `讀取商品資料失敗，HTTP ${response.status}`);
      }

      return Array.isArray(data) ? data.map(mapProductFromApi) : [];
    } finally {
      clearTimeout(timer);
    }
  };

  // 從 Django 讀取商品資料並執行自動跳轉與過濾判定
  const loadSavedProducts = async (force = false) => {
    try {
      setErrorMessage(null);
      const savedUserId = await getCurrentMemberId();
      setCurrentUserId(savedUserId);

      const cacheKey = getProductCacheKey(savedUserId);
      let cachedProducts: Product[] = [];

      const cachedRaw = await AsyncStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          cachedProducts = JSON.parse(cachedRaw);
          if (Array.isArray(cachedProducts)) {
            setProducts(cachedProducts);
          }
        } catch (e) {
          cachedProducts = [];
        }
      }

      const now = Date.now();
      if (!force && isFetchingRef.current) return;
      if (!force && cachedProducts.length > 0 && now - lastFetchAtRef.current < 15000) return;

      isFetchingRef.current = true;
      lastFetchAtRef.current = now;

      // 同時拉取全部、審核中、未通過的資料，確保同步最精確
      const requests = [
        fetchProductsByUrl(`${API_URL}/products/`),
        fetchProductsByUrl(`${API_URL}/products/pending/`),
        fetchProductsByUrl(`${API_URL}/products/rejected/`),
      ];

      const results = await Promise.allSettled(requests);
      const fetchedProducts = results.flatMap((result: any) =>
        result.status === 'fulfilled' ? result.value : []
      );

      if (fetchedProducts.length > 0 || cachedProducts.length > 0) {
        const mergedMap = new Map<string, Product>();
        cachedProducts.forEach(product => {
          if (product?.id) mergedMap.set(product.id, product);
        });
        fetchedProducts.forEach(product => {
          if (product?.id) mergedMap.set(product.id, product);
        });

        const mergedProducts = Array.from(mergedMap.values());
        mergedProducts.sort((a, b) => Number(b.id) - Number(a.id));

        // 💡 核心智慧跳轉邏輯
        // 找出這次撈回來的最新資料中，原本屬於當前使用者且在 prevPendingIdsRef 紀錄中「正在審核」的商品狀態變化
        if (prevPendingIdsRef.current.length > 0) {
          for (const pId of prevPendingIdsRef.current) {
            const currentProductState = mergedProducts.find(item => item.id === pId);
            
            if (currentProductState && currentProductState.creatorId === savedUserId) {
              // 1. 如果變成了已通過 (approved)
              if (currentProductState.status === 'approved') {
                setActiveTab('audit');
                setAuditSubTab('approved');
                break; // 跳轉完成，中斷迴圈
              }
              // 2. 如果變成了未通過 (rejected)
              else if (currentProductState.status === 'rejected') {
                setActiveTab('audit');
                setAuditSubTab('rejected');
                break; // 跳轉完成，中斷迴圈
              }
            }
          }
        }

        // 更新當前還在審核中的 ID 紀錄，供下一次輪詢比對
        const currentPendingIds = mergedProducts
          .filter(item => item.creatorId === savedUserId && item.status === 'pending')
          .map(item => item.id);
        
        prevPendingIdsRef.current = currentPendingIds;

        setProducts(mergedProducts);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mergedProducts));
      }

      const allFailed = results.every(result => result.status === 'rejected');
      if (allFailed && cachedProducts.length === 0) {
        setErrorMessage('⚠️ 無法從後端讀取商品資料，請確認 Django (8001) 是否已啟動。');
      }
    } catch (e: any) {
      console.error('讀取商品資料失敗:', e);
      setErrorMessage('⚠️ 連線失敗，請檢查網路或後端伺服器。');
    } finally {
      isFetchingRef.current = false;
    }
  };

  // 💡 建立高頻即時輪詢監聽機制：若當前有 pending 商品，每 3 秒自動向後端刷新確認狀態
  useEffect(() => {
    loadSavedProducts(true); // 頁面初次載入執行一次

    const intervalId = setInterval(() => {
      // 🎯 修正：從 productsRef 讀取最新資料，而不是直接依賴 state
      const hasActivePending = productsRef.current.some(
        item => item.creatorId === currentUserId && item.status === 'pending'
      );

      // 如果有任何一筆在審核中，強制背景刷新，達到「免刷新的自動跳轉」
      if (hasActivePending) {
        loadSavedProducts(true); 
      }
    }, 3000); // 3000ms = 3 秒

    return () => clearInterval(intervalId);
  }, [currentUserId]); // 🚀 關鍵：移除對 products 的監聽，徹底解決卡死問題

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWindowFocus = () => loadSavedProducts(true);
      window.addEventListener('focus', handleWindowFocus);
      return () => {
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedProducts(true);
    }, [activeTab, auditSubTab])
  );

  const handleTabChange = (tab: 'list' | 'audit') => {
    setActiveTab(tab);
    setSearchQuery('');
    loadSavedProducts(true);
  };

  const handleSubTabChange = (subTab: 'approved' | 'rejected') => {
    setAuditSubTab(subTab);
    setSearchQuery('');
    loadSavedProducts(true);
  };

  // 篩選過濾：確保商品列表在審核狀態一變更時，資料立刻從當前畫面消失
  const getFilteredDisplayProducts = () => {
    let baseList: Product[] = [];

    if (activeTab === 'list') {
      // 💡 商品列表：只顯示大眾已通過，以及自己建立且「還在審核中」的商品
      // 一旦通過 (approved 大眾都看得到) 或 拒絕 (rejected)，此筆資料就會自動從這個 Filter 條件中消失
      baseList = products.filter(item => {
        if (item.status === 'approved') return true;
        if (item.status === 'pending' && item.creatorId === currentUserId) return true;
        return false; 
      });
    } else {
      // 審核紀錄分頁
      if (auditSubTab === 'approved') {
        // 您的已通過商品
        baseList = products.filter(item => item.creatorId === currentUserId && item.status === 'approved');
      } else {
        // 您的未通過商品
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
    const savedUserId = await getCurrentMemberId();

    if (savedUserId === 'guest') {
      showCustomAlert('新增失敗', '找不到登入會員 ID，請重新登入後再試一次。', () => {}, '', txt.btnConfirm);
      return;
    }

    setIsModalVisible(false);

    // 送出審核請求，並立刻記錄下這筆商品的 pending 狀態
    try {
      const response = await fetch(`${API_URL}/products/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProductName.trim(),
          unit: formattedUnit,
          calories: calorieNum,
          member: Number(savedUserId),
        }),
      });

      const data = await parseApiResponse(response);
      if (response.ok && data.success !== false) {
        // 送審成功後，強制連線後端抓取最新資料，觸發審核中顯示
        await loadSavedProducts(true);
      }
    } catch (e) {
      console.log('新增商品要求失敗', e);
    }

    setTimeout(() => {
      showCustomAlert(txt.alertSubmitSuccessTitle, txt.alertSubmitSuccessMessage, () => {}, '', txt.btnConfirm);
    }, 500); 
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

            {/* 只有在 activeTab === 'list' 時才顯示新增功能 */}
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

          <Text style={styles.recentText}>{txt.recentSearchLabel}</Text>

          {/* 📦 資料列表 */}
          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {displayProducts.map((item) => {
                const isMyOwnProduct = item.creatorId === currentUserId;

                return (
                  <View key={item.id} style={styles.productRow}>
                    <View style={styles.nameAndStatusWrapper}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {formatDisplayInfo(item.name, item.unit)}
                        {activeTab === 'list' && isMyOwnProduct && item.status === 'pending' && (
                          <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                        )}
                      </Text>
                    </View>
                    
                    <Text style={styles.productCalorie}>
                      {txt.calorieLabelPrefix}{item.calories}{txt.calorieLabelSuffix}
                    </Text>
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
    fontSize: 15,
    color: '#333',
    width: '100%',
    height: '100%',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
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

  productCalorie: { flex: 1.5, fontSize: 15, color: '#888', textAlign: 'right', paddingRight: 10 },

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