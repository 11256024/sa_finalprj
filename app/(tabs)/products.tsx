// 檔案說明：商品頁面：讓使用者查詢商品、送出新增商品申請，並顯示審核狀態。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';
// 說明：後端 WebSocket 位址，用來接收商品審核資料的即時刷新通知。
const WS_URL = 'ws://127.0.0.1:8000/ws/admin-reviews/'; 

// 說明：Product 定義這個頁面會使用的資料欄位與型別。
interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending' | 'rejected';
  creatorId?: string;
}

// 說明：統一解析後端回應，避免後端不是 JSON 時讓錯誤訊息太難懂。
const parseApiResponse = async (response: any) => {
  // 說明：宣告 text，集中處理這段畫面邏輯會用到的資料或方法。
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`後端回傳格式非 JSON (${response.status})`);
  }
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
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

// 說明：宣告 pageLanguageConfig，集中處理這段畫面邏輯會用到的資料或方法。
const pageLanguageConfig = {
  appName: '食半功倍',
  pageTitle: ' 查 詢 商 品',
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
  emptyResultText: '找不到相關商品',
  loadingText: '載入中，請稍後', 
  
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

// 說明：ProductsScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function ProductsScreen() {
  // 說明：宣告 txt，集中處理這段畫面邏輯會用到的資料或方法。
  const txt = pageLanguageConfig;

  const [activeTab, setActiveTab] = useState<'list' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending'); 

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]); 
  const [currentUserId, setCurrentUserId] = useState(''); 
  // 說明：保存 wsRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const wsRef = useRef<WebSocket | null>(null);
  
  // 🌟 新增全域載入狀態控制旗標，初始預設為 true
  const [isLoading, setIsLoading] = useState(true);

  // 說明：保存 cacheMapRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const cacheMapRef = useRef<Map<string, Product[]>>(new Map());
  // 說明：保存 isFetchingRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const isFetchingRef = useRef(false);
  // 說明：保存 productsRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const productsRef = useRef<Product[]>([]);
  
  // 說明：保存 activeTabRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const activeTabRef = useRef(activeTab);
  // 說明：保存 auditSubTabRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const auditSubTabRef = useRef(auditSubTab);

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => { productsRef.current = products; }, [products]);
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => { auditSubTabRef.current = auditSubTab; }, [auditSubTab]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  // 說明：保存 amountInputRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const amountInputRef = useRef<TextInput>(null);
  // 說明：保存 calorieInputRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const calorieInputRef = useRef<TextInput>(null);

  // 說明：整理顯示文字，讓資料在畫面上比較乾淨易讀。
  const formatDisplayInfo = (name: string, unit: string) => {
    let cleanName = name ? name.trim() : '';
    let cleanUnit = unit ? unit.trim() : '';
    if (cleanName.includes('/') || cleanName.includes(cleanUnit)) {
      // 說明：宣告 parts，集中處理這段畫面邏輯會用到的資料或方法。
      const parts = cleanName.split('/');
      if (parts.length > 1) {
        cleanName = parts[0].trim();
      } else if (cleanName.endsWith(cleanUnit)) {
        cleanName = cleanName.substring(0, cleanName.length - cleanUnit.length).trim();
      }
    }
    return cleanUnit ? `${cleanName} / ${cleanUnit}` : cleanName;
  };

  // 說明：讀取目前登入者 ID，之後用來組 AsyncStorage key 或呼叫會員 API。
  const getCurrentMemberId = async () => {
    try {
      // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
      const userStr = await AsyncStorage.getItem('user');
      // 說明：宣告 currentUser，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUser = userStr ? JSON.parse(userStr) : null;
      // 說明：宣告 savedId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedId = currentUser?.id?.toString?.() || await AsyncStorage.getItem('current_user_id') || '';
      return /^\d+$/.test(savedId) ? savedId : '';
    } catch {
      return '';
    }
  };

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const fetchProductsByUrl = async (url: string) => {
    try {
      // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
      const response = await fetch(url);
      // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
      const data = await parseApiResponse(response);
      if (Array.isArray(data)) {
        // 說明：宣告 mapped，集中處理這段畫面邏輯會用到的資料或方法。
        const mapped = data.map(mapProductFromApi);
        cacheMapRef.current.set(url, mapped); 
        return mapped;
      }
      return [];
    } catch (e) {
      console.error(`連線失敗網址: ${url}`, e);
      return cacheMapRef.current.get(url) || [];
    }
  };

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const loadSavedProducts = async (force = false) => {
    if (isFetchingRef.current) {
      // 已有同時進行的請求；不要在這裡關掉 isLoading，否則畫面會先閃「找不到相關商品」。
      // 等正在跑的那個請求結束，自然會把 isLoading 關掉。
      return;
    }
    isFetchingRef.current = true;

    try {
      // 說明：宣告 savedUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedUserId = await getCurrentMemberId();
      if (currentUserId !== savedUserId) setCurrentUserId(savedUserId);

      let targetUrl = `${API_URL}/products/`;
      if (activeTabRef.current === 'audit') {
        if (auditSubTabRef.current === 'pending') {
          targetUrl = `${API_URL}/products/pending/`;
        } else if (auditSubTabRef.current === 'rejected') {
          targetUrl = `${API_URL}/products/rejected/`;
        }
      }

      // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
      const fetchedData = await fetchProductsByUrl(targetUrl);

      // 說明：宣告 mergedMap，集中處理這段畫面邏輯會用到的資料或方法。
      const mergedMap = new Map<string, Product>();
      
      cacheMapRef.current.forEach((productList) => {
        productList.forEach(p => mergedMap.set(p.id, p));
      });
      fetchedData.forEach(p => mergedMap.set(p.id, p));

      productsRef.current.forEach(p => {
        if (p.id.startsWith('virtual_')) {
          // 說明：宣告 matched，集中處理這段畫面邏輯會用到的資料或方法。
          const matched = Array.from(mergedMap.values()).find(f => f.name === p.name && f.unit === p.unit);
          if (!matched) mergedMap.set(p.id, p);
        }
      });

      // 說明：宣告 sortedProducts，集中處理這段畫面邏輯會用到的資料或方法。
      const sortedProducts = Array.from(mergedMap.values()).sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;

        // 說明：宣告 idA，集中處理這段畫面邏輯會用到的資料或方法。
        const idA = a.id.startsWith('virtual_') ? Number(a.id.replace('virtual_', '')) : Number(a.id);
        // 說明：宣告 idB，集中處理這段畫面邏輯會用到的資料或方法。
        const idB = b.id.startsWith('virtual_') ? Number(b.id.replace('virtual_', '')) : Number(b.id);
        return idB - idA;
      });

      if (JSON.stringify(productsRef.current) !== JSON.stringify(sortedProducts)) {
        requestAnimationFrame(() => {
          setProducts(sortedProducts);
        });
      }
    } catch (e) {
      console.error('刷新發生錯誤:', e);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false); // 🌟 當前 API 載入完畢，關閉載入狀態
    }
  };

  // 初始化與 WebSocket 機制
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    getCurrentMemberId().then(id => {
      setCurrentUserId(id);
      loadSavedProducts(true);
    });

    // 說明：宣告 ws，集中處理這段畫面邏輯會用到的資料或方法。
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = () => {
      setTimeout(() => loadSavedProducts(true), 30);
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 全域高頻 1 秒自動背景同步計時器
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    // 說明：宣告 intervalId，集中處理這段畫面邏輯會用到的資料或方法。
    const intervalId = setInterval(() => {
      loadSavedProducts(true); 
    }, 1000); 

    return () => clearInterval(intervalId);
  }, []); 

  // 當使用者「按分頁」時切換
  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleTabChange = (tab: 'list' | 'audit', subTab?: 'pending' | 'approved' | 'rejected') => {
    // 🌟 切換分頁時立即把載入狀態拉回 true，避免顯示上一頁留下來的空資料文字
    setIsLoading(true); 

    requestAnimationFrame(() => {
      if (tab === 'list') {
        setActiveTab('list');
      } else {
        setActiveTab('audit');
        if (subTab) setAuditSubTab(subTab);
      }
      setSearchQuery('');
      
      setTimeout(() => {
        loadSavedProducts(true);
      }, 0);
    });
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useFocusEffect(
    useCallback(() => { 
      setIsLoading(true); // 🌟 頁面 Focus 進來時也先進入載入狀態
      loadSavedProducts(true); 
    }, [])
  );

  // 說明：依照關鍵字或頁籤條件篩選要顯示的資料。
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

  // 說明：宣告 clearForm，集中處理這段畫面邏輯會用到的資料或方法。
  const clearForm = () => {
    setNewProductName('');
    setNewProductAmount('');
    setUnitType('g');
    setNewProductCalorie('');
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
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

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
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

    // 說明：整理顯示文字，讓資料在畫面上比較乾淨易讀。
    const formattedUnit = `${newProductAmount}${unitType === 'g' ? '克' : 'ml'}`;
    // 說明：宣告 savedUserId，集中處理這段畫面邏輯會用到的資料或方法。
    const savedUserId = await getCurrentMemberId();

    // 說明：宣告 virtualId，集中處理這段畫面邏輯會用到的資料或方法。
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
    
    handleTabChange('audit', 'pending');

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

  // 說明：宣告 displayProducts，集中處理這段畫面邏輯會用到的資料或方法。
  const displayProducts = getFilteredDisplayProducts();

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          <View style={styles.cardHeader}>
            <View style={styles.titleTabRow}>
              <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'list' && styles.mainTabButtonActive]} onPress={() => handleTabChange('list')}>
                <Text style={[styles.mainTabLabel, activeTab === 'list' && styles.mainTabLabelActive]}>{txt.tabProductList}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'audit' && styles.mainTabButtonActive]} onPress={() => handleTabChange('audit', 'pending')}>
                <Text style={[styles.mainTabLabel, activeTab === 'audit' && styles.mainTabLabelActive]}>{txt.tabAuditHistory}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setIsModalVisible(true)}><Text style={styles.addText}>{txt.addButtonText}</Text></TouchableOpacity>
          </View>

          {activeTab === 'audit' && (
            <View style={styles.subTabToggleContainer}>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'pending' && styles.subTabItemActive]} onPress={() => handleTabChange('audit', 'pending')}>
                <Text style={[styles.subTabLinkText, auditSubTab === 'pending' && styles.subTabLinkTextActive]}>{txt.subTabPending}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'approved' && styles.subTabItemActive]} onPress={() => handleTabChange('audit', 'approved')}>
                <Text style={[styles.subTabLinkText, auditSubTab === 'approved' && styles.subTabLinkTextActive]}>{txt.subTabApproved}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'rejected' && styles.subTabItemActive]} onPress={() => handleTabChange('audit', 'rejected')}>
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
                      {item.status === 'pending' && (
                        <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                      )}
                    </Text>
                  </View>
                  <Text style={styles.productCalorie}>{txt.calorieLabelPrefix}{item.calories}{txt.calorieLabelSuffix}</Text>
                </View>
              ))}
              
              {/* 🌟 核心修改邏輯：區分載入中與真正無資料 */}
              {displayProducts.length === 0 && (
                isLoading ? (
                  <Text style={styles.loadingText}>{txt.loadingText}</Text>
                ) : (
                  <Text style={styles.emptyText}>{txt.emptyResultText}</Text>
                )
              )}
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

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
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
  loadingText: { textAlign: 'center', color: '#95B09B', marginTop: 30, fontSize: 15, fontWeight: '500' }, // 🌟 載入中文字樣式
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