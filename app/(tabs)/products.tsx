import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://127.0.0.1:8001';
const WS_URL = 'ws://127.0.0.1:8001/ws/admin-reviews/'; 

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
    throw new Error(`後端回傳格式非 JSON (${response.status})`);
  }
};

const mapProductFromApi = (item: any): Product => {
  let cId = '';
  if (item.creator_id !== null && item.creator_id !== undefined) {
    cId = String(item.creator_id);
  } else if (item.creator && typeof item.creator === 'object' && item.creator.id !== undefined) {
    cId = String(item.creator.id);
  } else if (item.creator !== null && item.creator !== undefined) {
    cId = String(item.creator);
  } else if (item.member !== null && item.member !== undefined) {
    cId = String(item.member);
  }

  return {
    id: String(item.id),
    name: item.name || '',
    unit: item.unit || '',
    calories: Number(item.calories || 0),
    status: item.status || 'approved',
    creatorId: cId,
  };
};

const pageLanguageConfig = {
  appName: '食半功倍',
  pageTitle: '新 增 / 刪 除 商 品',
  tabProductList: '商品列表',      
  tabAuditHistory: '審核紀錄',     
  subTabPending: '待審核', 
  subTabApproved: '已通過審核', 
  subTabRejected: '未通過審核', 
  addButtonText: '+ 新 增',
  searchPlaceholder: '🔍   輸 入 商 品 名 稱',
  searchCancel: '取 消',
  recentSearchLabel: '近 期 資 料', 
  calorieLabelPrefix: '熱量（',
  calorieLabelSuffix: ' 大卡）',
  emptyResultText: '找不到相關商品（請確認後台是否有審核通過的資料）',
  
  alertWarningTitle: '提示',
  alertMissingFields: '請填寫完整的商品名稱、單位與熱量！',
  
  alertSubmitSuccessTitle: '商品已送出審核',
  alertSubmitSuccessMessage: '管理員審核通過後將會正式入庫供大眾搜尋。在此之前，您可以至「審核紀錄 ＞ 待審核」查看狀態並直接使用它來計算熱量！',
  
  statusPending: ' （審核中，可用於計算）', 

  btnConfirm: '確定',
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

  const [activeTab, setActiveTab] = useState<'list' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending'); 

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]); 
  const [currentUserId, setCurrentUserId] = useState(''); 
  const wsRef = useRef<WebSocket | null>(null);
  
  const isFetchingRef = useRef(false);
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  const amountInputRef = useRef<TextInput>(null);
  const calorieInputRef = useRef<TextInput>(null);

  const formatDisplayInfo = (name: string, unit: string) => {
    let cleanName = name ? name.trim() : '';
    let cleanUnit = unit ? unit.trim() : '';
    if (cleanName.includes('/') || cleanName.includes(cleanUnit)) {
      const parts = cleanName.split('/');
      if (parts.length > 1) {
        cleanName = parts[0].trim();
      } else if (cleanName.endsWith(cleanUnit)) {
        cleanName = cleanName.substring(0, cleanName.length - cleanUnit.length).trim();
      }
    }
    return cleanUnit ? `${cleanName} / ${cleanUnit}` : cleanName;
  };

  const getCurrentMemberId = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const savedId = currentUser?.id?.toString?.() || await AsyncStorage.getItem('current_user_id') || '';
      return /^\d+$/.test(savedId) ? savedId : '';
    } catch {
      return '';
    }
  };

  const fetchProductsByUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      const data = await parseApiResponse(response);
      if (Array.isArray(data)) {
        return data.map(mapProductFromApi);
      }
      return [];
    } catch (e) {
      console.error(`連線失敗網址: ${url}`, e);
      return [];
    }
  };

  const loadSavedProducts = async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const savedUserId = await getCurrentMemberId();
      if (currentUserId !== savedUserId) setCurrentUserId(savedUserId);

      const [approvedData, pendingData, rejectedData] = await Promise.all([
        fetchProductsByUrl(`${API_URL}/products/`),
        fetchProductsByUrl(`${API_URL}/products/pending/`),
        fetchProductsByUrl(`${API_URL}/products/rejected/`),
      ]);

      const mergedMap = new Map<string, Product>();
      pendingData.forEach(p => mergedMap.set(p.id, p));
      rejectedData.forEach(p => mergedMap.set(p.id, p));
      approvedData.forEach(p => mergedMap.set(p.id, p));

      productsRef.current.forEach(p => {
        if (p.id.startsWith('virtual_')) {
          const matched = [...approvedData, ...pendingData].find(f => f.name === p.name && f.unit === p.unit);
          if (!matched) mergedMap.set(p.id, p);
        }
      });

      // 🌟 精準排序邏輯：讓新送出的商品或待審核商品永遠排在最頂端
      const sortedProducts = Array.from(mergedMap.values()).sort((a, b) => {
        // 1. 如果其中一個是 pending（審核中），另一個不是，pending 必須排在最前面
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;

        // 2. 如果兩個狀態相同，則比對 ID（處理 virtual_ 時間戳字串與數值 ID，由新排到舊）
        const idA = a.id.startsWith('virtual_') ? Number(a.id.replace('virtual_', '')) : Number(a.id);
        const idB = b.id.startsWith('virtual_') ? Number(b.id.replace('virtual_', '')) : Number(b.id);
        
        return idB - idA;
      });

      const currentJson = JSON.stringify(productsRef.current);
      const nextJson = JSON.stringify(sortedProducts);
      
      if (currentJson !== nextJson) {
        requestAnimationFrame(() => {
          setProducts(sortedProducts);
        });
      }
    } catch (e) {
      console.error('刷新發生錯誤:', e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // 初始化與 WebSocket 機制
  useEffect(() => {
    getCurrentMemberId().then(id => {
      setCurrentUserId(id);
      loadSavedProducts(true);
    });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = () => {
      setTimeout(() => loadSavedProducts(true), 100);
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 🌟 關鍵新增功能：針對「已通過審核」與「未通過審核」分頁，每 3 秒背景定時自動刷新機制
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // 只有當使用者切換到「審核紀錄」分頁，且選中「已通過」或「未通過」子標籤時，才開啟計時器
    if (activeTab === 'audit' && (auditSubTab === 'approved' || auditSubTab === 'rejected')) {
      intervalId = setInterval(() => {
        loadSavedProducts(true); 
      }, 3000);
    }

    // 當狀態切換或元件卸載時，自動清除計時器，絕不浪費效能與手機電力
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab, auditSubTab]);

  useFocusEffect(
    useCallback(() => { 
      loadSavedProducts(true); 
    }, [])
  );

  const getFilteredDisplayProducts = () => {
    let baseList: Product[] = [];

    if (activeTab === 'list') {
      baseList = products.filter(item => item.status === 'approved');
    } else {
      if (auditSubTab === 'pending') {
        baseList = products.filter(item => item.status === 'pending' && item.creatorId === currentUserId);
      } else if (auditSubTab === 'approved') {
        baseList = products.filter(item => item.status === 'approved' && item.creatorId === currentUserId);
      } else {
        baseList = products.filter(item => item.status === 'rejected' && item.creatorId === currentUserId);
      }
    }

    if (searchQuery.trim() !== '') {
      baseList = baseList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return baseList;
  };

  const [customAlert, setCustomAlert] = useState<{ 
    visible: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void; 
    confirmText?: string;
    showCancel?: boolean;
    onCancel?: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const clearForm = () => {
    setNewProductName('');
    setNewProductAmount('');
    setUnitType('g');
    setNewProductCalorie('');
  };

  const handleCancelAdd = () => {
    if (newProductName.trim() || newProductAmount.trim() || newProductCalorie.trim()) {
      setCustomAlert({
        visible: true,
        title: '取消新增',
        message: '您輸入的資料尚未儲存，確定要放棄並關閉視窗嗎？',
        confirmText: '確定放棄',
        showCancel: true,
        onConfirm: () => {
          clearForm();
          setIsModalVisible(false);
        },
        onCancel: () => {}
      });
    } else {
      clearForm();
      setIsModalVisible(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (!newProductName.trim() || !newProductAmount.trim() || !newProductCalorie.trim()) {
      setCustomAlert({ 
        visible: true, 
        title: txt.alertWarningTitle, 
        message: txt.alertMissingFields, 
        onConfirm: () => {}, 
        confirmText: txt.btnConfirm,
        showCancel: false 
      });
      return;
    }

    const formattedUnit = `${newProductAmount}${unitType === 'g' ? '克' : 'ml'}`;
    const savedUserId = await getCurrentMemberId();

    // 🌟 產生的虛擬 ID 格式如 virtual_1716900000000，排序時能精確轉回數字排列在頂端
    const virtualId = `virtual_${Date.now()}`;
    const virtualProduct: Product = {
      id: virtualId,
      name: newProductName.trim(),
      unit: formattedUnit,
      calories: parseInt(newProductCalorie, 10),
      status: 'pending',
      creatorId: savedUserId,
    };

    setProducts(prev => [virtualProduct, ...prev]);
    setIsModalVisible(false);
    
    setActiveTab('audit');
    setAuditSubTab('pending');

    setCustomAlert({
      visible: true,
      title: txt.alertSubmitSuccessTitle,
      message: `商品「${newProductName.trim()} / ${formattedUnit}」${txt.alertSubmitSuccessMessage}`,
      onConfirm: () => {},
      confirmText: txt.btnConfirm,
      showCancel: false
    });

    clearForm();

    try {
      await fetch(`${API_URL}/products/add/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName.trim(),
          unit: formattedUnit,
          calories: parseInt(newProductCalorie, 10),
          member: Number(savedUserId),
        }),
      });
      loadSavedProducts(true);
    } catch {
      setProducts(prev => prev.filter(item => item.id !== virtualId));
    }
  };

  const displayProducts = getFilteredDisplayProducts();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          <View style={styles.cardHeader}>
            <View style={styles.titleTabRow}>
              <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'list' && styles.mainTabButtonActive]} onPress={() => { setActiveTab('list'); setSearchQuery(''); }}>
                <Text style={[styles.mainTabLabel, activeTab === 'list' && styles.mainTabLabelActive]}>{txt.tabProductList}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'audit' && styles.mainTabButtonActive]} onPress={() => { setActiveTab('audit'); setAuditSubTab('pending'); setSearchQuery(''); }}>
                <Text style={[styles.mainTabLabel, activeTab === 'audit' && styles.mainTabLabelActive]}>{txt.tabAuditHistory}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setIsModalVisible(true)}><Text style={styles.addText}>{txt.addButtonText}</Text></TouchableOpacity>
          </View>

          {activeTab === 'audit' && (
            <View style={styles.subTabToggleContainer}>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'pending' && styles.subTabItemActive]} onPress={() => setAuditSubTab('pending')}>
                <Text style={[styles.subTabLinkText, auditSubTab === 'pending' && styles.subTabLinkTextActive]}>{txt.subTabPending}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'approved' && styles.subTabItemActive]} onPress={() => setAuditSubTab('approved')}>
                <Text style={[styles.subTabLinkText, auditSubTab === 'approved' && styles.subTabLinkTextActive]}>{txt.subTabApproved}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'rejected' && styles.subTabItemActive]} onPress={() => setAuditSubTab('rejected')}>
                <Text style={[styles.subTabLinkText, auditSubTab === 'rejected' && styles.subTabLinkTextActive]}>{txt.subTabRejected}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.searchRowContainer}>
            <View style={styles.searchBoxWrapper}>
              <TextInput style={styles.searchInput} placeholder={txt.searchPlaceholder} placeholderTextColor="#999" value={searchQuery} onChangeText={setSearchQuery} />
            </View>
          </View>

          <Text style={styles.recentText}>{txt.recentSearchLabel}</Text>

          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true}>
              {displayProducts.map((item) => (
                <View key={item.id} style={styles.productRow}>
                  <View style={styles.nameAndStatusWrapper}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {formatDisplayInfo(item.name, item.unit)}
                      {auditSubTab === 'pending' && item.status === 'pending' && (
                        <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                      )}
                    </Text>
                  </View>
                  <Text style={styles.productCalorie}>{txt.calorieLabelPrefix}{item.calories}{txt.calorieLabelSuffix}</Text>
                </View>
              ))}
              {displayProducts.length === 0 && <Text style={styles.emptyText}>{txt.emptyResultText}</Text>}
            </ScrollView>
          </View>

        </View>
      </View>

      {/* 新增商品彈窗 */}
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={handleCancelAdd}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={handleCancelAdd}>
          <TouchableOpacity activeOpacity={1} style={styles.squareModalContent}>
            <Text style={styles.orangeModalTitle}>{txt.modalTitle}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelName}</Text>
              <TextInput style={styles.underlineInput} value={newProductName} onChangeText={setNewProductName} placeholder={txt.namePlaceholder} placeholderTextColor="#A9A9A9" autoFocus={true} returnKeyType="next" onSubmitEditing={() => amountInputRef.current?.focus()} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelUnit}</Text>
              <View style={styles.unitRowFlexContainer}>
                <TextInput ref={amountInputRef} style={[styles.underlineInput, styles.amountInputInput]} value={newProductAmount} onChangeText={t => setNewProductAmount(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder={txt.amountPlaceholder} placeholderTextColor="#A9A9A9" returnKeyType="next" onSubmitEditing={() => calorieInputRef.current?.focus()} />
                <View style={styles.capsuleToggleGroup}>
                  <TouchableOpacity style={[styles.capsuleItem, unitType === 'g' && styles.capsuleItemActive]} onPress={() => setUnitType('g')}><Text style={[styles.capsuleText, unitType === 'g' && styles.capsuleTextActive]}>克</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.capsuleItem, unitType === 'ml' && styles.capsuleItemActive]} onPress={() => setUnitType('ml')}><Text style={[styles.capsuleText, unitType === 'ml' && styles.capsuleTextActive]}>ml</Text></TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelCalorie}</Text>
              <TextInput ref={calorieInputRef} style={styles.underlineInput} value={newProductCalorie} onChangeText={t => setNewProductCalorie(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder={txt.caloriePlaceholder} placeholderTextColor="#A9A9A9" returnKeyType="done" onSubmitEditing={handleConfirmAdd} />
            </View>
            <View style={styles.orangeRowButtonGroup}>
              <TouchableOpacity style={styles.orangeCancelBtn} onPress={handleCancelAdd}><Text style={styles.orangeCancelBtnText}>{txt.modalCancel}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.orangeConfirmBtn} onPress={handleConfirmAdd}><Text style={styles.orangeConfirmBtnText}>{txt.modalConfirm}</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 提示 Alert 彈窗 */}
      <Modal animationType="fade" transparent={true} visible={customAlert.visible} onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            {customAlert.message ? <Text style={styles.alertMessage}>{customAlert.message}</Text> : null}
            <View style={styles.modalButtonGroup}>
              {customAlert.showCancel && (
                <TouchableOpacity style={[styles.modalBtn, styles.grayAlertBtn, { marginRight: 15 }]} onPress={() => { setCustomAlert(prev => ({ ...prev, visible: false })); if(customAlert.onCancel) customAlert.onCancel(); }}>
                  <Text style={styles.modalBtnCancelText}>繼續輸入</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={() => { setCustomAlert(prev => ({ ...prev, visible: false })); customAlert.onConfirm(); }}>
                <Text style={styles.modalBtnConfirmText}>{customAlert.confirmText || txt.btnConfirm}</Text>
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
  cardContainer: { flex: 1, backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingTop: 35, paddingBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, alignItems: 'center', marginBottom: 15 },
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
  searchBoxWrapper: { flex: 1, backgroundColor: '#EBEBEB', borderRadius: 25, paddingHorizontal: 20, height: 46, justifyContent: 'center' },
  searchInput: { fontSize: 15, color: '#333', width: '100%', height: '100%', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  recentText: { fontSize: 14, color: '#A0A0A0', marginBottom: 15, paddingLeft: 5, letterSpacing: 1 },
  listContainer: { flex: 1, width: '100%' },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 20, paddingHorizontal: 5 },
  nameAndStatusWrapper: { flex: 2, justifyContent: 'center' },
  productName: { fontSize: 16, color: '#333', fontWeight: '500' },
  pendingStatusTag: { fontSize: 14, color: '#E67E22', fontWeight: 'bold' },
  productCalorie: { flex: 1.5, fontSize: 15, color: '#888', textAlign: 'right', paddingRight: 10 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  squareModalContent: { backgroundColor: '#FFDDBB', width: 440, height: 440, paddingHorizontal: 40, justifyContent: 'center', borderRadius: 24 },
  orangeModalTitle: { fontSize: 26, fontWeight: 'bold', color: '#000', letterSpacing: 3, textAlign: 'center', marginBottom: 25 },
  inputGroup: { marginBottom: 20, width: '100%' },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 5 },
  underlineInput: { borderBottomWidth: 1, borderBottomColor: '#666', fontSize: 15, color: '#333', height: 35, width: '100%' },
  unitRowFlexContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  amountInputInput: { flex: 1, marginRight: 25 },
  capsuleToggleGroup: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#9EBAA4', borderRadius: 8, overflow: 'hidden', height: 34, width: 105, backgroundColor: '#FFF' },
  capsuleItem: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  capsuleItemActive: { backgroundColor: '#95B09B' },
  capsuleText: { fontSize: 14, color: '#95B09B', fontWeight: '700' },
  capsuleTextActive: { color: '#FFF' },
  orangeRowButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, paddingHorizontal: 10 },
  orangeCancelBtn: { backgroundColor: '#EAEAEA', borderWidth: 1.5, borderColor: '#000', width: '45%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  orangeCancelBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  orangeConfirmBtn: { backgroundColor: '#FFAA77', borderWidth: 1.5, borderColor: '#000', width: '45%', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  orangeConfirmBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20 },
  alertTitle: { fontSize: 19, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  modalBtn: { paddingHorizontal: 30, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  orangeAlertBtn: { backgroundColor: '#FFAA77' },
  grayAlertBtn: { backgroundColor: '#E0E0E0' },
  modalBtnConfirmText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  modalBtnCancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' }
});