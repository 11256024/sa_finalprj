// 檔案說明：管理者商品審核頁面：讓管理者新增官方商品、審核使用者送出的商品，以及刪除商品。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
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
  creatorRole?: string;
  creatorUsername?: string;
}

// 說明：統一解析後端回應，避免後端不是 JSON 時讓錯誤訊息太難懂。
const parseApiResponse = async (response: Response) => {
  // 說明：宣告 text，集中處理這段畫面邏輯會用到的資料或方法。
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
  }
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
const getCreatorIdFromApi = (item: any) => {
  if (item.creator_id !== null && item.creator_id !== undefined) return String(item.creator_id);
  if (item.creator && typeof item.creator === 'object' && item.creator.id !== undefined) return String(item.creator.id);
  if (item.creator !== null && item.creator !== undefined) return String(item.creator);
  return '';
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
const getCreatorRoleFromApi = (item: any) => {
  if (item.creator_role) return String(item.creator_role);
  if (item.creatorRole) return String(item.creatorRole);
  if (item.creator && typeof item.creator === 'object' && item.creator.role) return String(item.creator.role);
  return '';
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
const getCreatorUsernameFromApi = (item: any) => {
  if (item.creator_username) return String(item.creator_username);
  if (item.creatorUsername) return String(item.creatorUsername);
  if (item.creator && typeof item.creator === 'object' && item.creator.username) return String(item.creator.username);
  return '';
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
const mapProductFromApi = (item: any): Product => ({
  id: String(item.id),
  name: item.name || '',
  unit: item.unit || '',
  calories: Number(item.calories || 0),
  status: item.status || 'approved',
  creatorId: getCreatorIdFromApi(item),
  creatorRole: getCreatorRoleFromApi(item),
  creatorUsername: getCreatorUsernameFromApi(item),
});

// 說明：宣告 getCreatorSourceText，集中處理這段畫面邏輯會用到的資料或方法。
const getCreatorSourceText = (item: Product) => {
  // 說明：宣告 creatorId，集中處理這段畫面邏輯會用到的資料或方法。
  const creatorId = item.creatorId || 'guest';
  // 說明：宣告 creatorRole，集中處理這段畫面邏輯會用到的資料或方法。
  const creatorRole = String(item.creatorRole || '').toLowerCase();
  // 說明：宣告 roleText，集中處理這段畫面邏輯會用到的資料或方法。
  const roleText = creatorRole === 'admin' ? '管理者' : '使用者';
  return `商品來源：${creatorId} (${roleText})`;
};

// 說明：控制提示訊息或畫面顯示條件。
const showMessage = (message: string) => {
  if (Platform.OS === 'web') window.alert(message);
};

// 說明：AdminReviewScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function AdminReviewScreen() {
  
  const [currentUserId, setCurrentUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'user_pending' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'admin_add' | 'approved' | 'rejected'>('admin_add');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  // 🕒 新增：控管全域載入狀態（預設第一趟進來為 true）
  const [isLoading, setIsLoading] = useState(true);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; unit: string; action: 'approve' | 'reject' } | null>(null);
  
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnitValue, setNewProdUnitValue] = useState(''); 
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');     
  const [newProdCalories, setNewProdCalories] = useState('');
  const [cancelWarningVisible, setCancelWarningVisible] = useState(false);
  const [errors, setErrors] = useState({ name: '', unit: '', calories: '' });

  // 說明：保存 isFetchingRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const isFetchingRef = useRef(false);
  // 說明：保存 wsRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const wsRef = useRef<WebSocket | null>(null);

  // 說明：保存 unitInputRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const unitInputRef = useRef<TextInput>(null);
  // 說明：保存 caloriesInputRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const caloriesInputRef = useRef<TextInput>(null);

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
    if (cleanUnit.includes('/')) {
      // 說明：宣告 unitParts，集中處理這段畫面邏輯會用到的資料或方法。
      const unitParts = cleanUnit.split('/');
      if (unitParts[0].trim() === unitParts[1].trim()) {
        cleanUnit = unitParts[0].trim();
      }
    }
    return { displayName: cleanName || '未命名商品', displayUnit: cleanUnit };
  };

  // 說明：讀取目前登入者 ID，之後用來組 AsyncStorage key 或呼叫會員 API。
  const getCurrentAdminId = async () => {
    try {
      // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
      const userStr = await AsyncStorage.getItem('user');
      // 說明：宣告 currentUser，集中處理這段畫面邏輯會用到的資料或方法。
      const currentUser = userStr ? JSON.parse(userStr) : null;
      // 說明：宣告 savedId，集中處理這段畫面邏輯會用到的資料或方法。
      const savedId = currentUser?.id?.toString?.() || await AsyncStorage.getItem('current_user_id') || '';
      return /^\d+$/.test(savedId) ? savedId : '';
    } catch (e) {
      return '';
    }
  };

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const fetchGlobalProducts = async (isBackground = false) => {
    if (isFetchingRef.current) return; 
    isFetchingRef.current = true;

    // 如果不是背景靜態同步（例如初次進入、手動切換等），就顯示載入中
    if (!isBackground) {
      setIsLoading(true);
    }

    try {
      // 說明：宣告 t，集中處理這段畫面邏輯會用到的資料或方法。
      const t = Date.now();
      const [approvedRes, pendingRes, rejectedRes] = await Promise.all([
        fetch(`${API_URL}/products/?t=${t}`),
        fetch(`${API_URL}/products/pending/?t=${t}`),
        fetch(`${API_URL}/products/rejected/?t=${t}`),
      ]);

      // 說明：宣告 approvedData，集中處理這段畫面邏輯會用到的資料或方法。
      const approvedData = await parseApiResponse(approvedRes);
      // 說明：宣告 pendingData，集中處理這段畫面邏輯會用到的資料或方法。
      const pendingData = await parseApiResponse(pendingRes);
      // 說明：宣告 rejectedData，集中處理這段畫面邏輯會用到的資料或方法。
      const rejectedData = await parseApiResponse(rejectedRes);

      if (!approvedRes.ok || !pendingRes.ok || !rejectedRes.ok) throw new Error('讀取失敗');

      // 說明：宣告 mergedMap，集中處理這段畫面邏輯會用到的資料或方法。
      const mergedMap = new Map<string, Product>();
      (Array.isArray(pendingData) ? pendingData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));
      (Array.isArray(rejectedData) ? rejectedData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));
      (Array.isArray(approvedData) ? approvedData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));

      // 說明：宣告 mergedList，集中處理這段畫面邏輯會用到的資料或方法。
      const mergedList = Array.from(mergedMap.values());

      setAllProducts(prev => {
        return mergedList.map(newItem => {
          // 說明：宣告 existing，集中處理這段畫面邏輯會用到的資料或方法。
          const existing = prev.find(p => p.id === newItem.id);
          if (existing && existing.status !== 'pending' && newItem.status === 'pending') {
            return existing;
          }
          return newItem;
        }).sort((a, b) => Number(b.id) - Number(a.id));
      });
    } catch (e) {
      console.error('更新列表失敗:', e);
      if (!isBackground) showMessage('無法同步後端最新資料。');
    } finally {
      isFetchingRef.current = false;
      // 🕒 更新結束：將載入狀態解除
      setIsLoading(false);
    }
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    getCurrentAdminId().then(id => { if (id) setCurrentUserId(id); });
    fetchGlobalProducts(false);

    // 說明：宣告 connectWebSocket，集中處理這段畫面邏輯會用到的資料或方法。
    const connectWebSocket = () => {
      console.log('正在建立即時刷新 WebSocket 連線...');
      // 說明：宣告 ws，集中處理這段畫面邏輯會用到的資料或方法。
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
          const data = JSON.parse(event.data);
          if (data.type === 'REFRESH_DATA') {
            fetchGlobalProducts(true); 
          }
        } catch (err) {
          console.log('WS 數據解析失敗', err);
        }
      };

      ws.onerror = (e) => console.log('WS 發生錯誤:', e);
      ws.onclose = () => {
        console.log('WS 連線已中斷，將在 5 秒後自動重新連線...');
        setTimeout(() => connectWebSocket(), 5000);
      };
    };

    connectWebSocket();

    // 說明：宣告 refreshInterval，集中處理這段畫面邏輯會用到的資料或方法。
    const refreshInterval = 3000;

    // 說明：宣告 pollingTimer，集中處理這段畫面邏輯會用到的資料或方法。
    const pollingTimer = setInterval(() => {
      fetchGlobalProducts(true); 
    }, refreshInterval);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pollingTimer);
    };
  }, [activeTab]);

  // 說明：依照關鍵字或頁籤條件篩選要顯示的資料。
  const getFilteredProducts = () => {
    // 說明：宣告 sortedProducts，集中處理這段畫面邏輯會用到的資料或方法。
    const sortedProducts = [...allProducts].sort((a, b) => Number(b.id) - Number(a.id));
    if (activeTab === 'list') return sortedProducts.filter(p => p.status === 'approved');
    if (activeTab === 'user_pending') return sortedProducts.filter(p => p.status === 'pending' && p.creatorId !== currentUserId);
    if (activeTab === 'audit') {
      if (auditSubTab === 'admin_add') return sortedProducts.filter(p => p.creatorId === currentUserId);
      if (auditSubTab === 'approved') return sortedProducts.filter(p => p.status === 'approved' && p.creatorId !== currentUserId);
      if (auditSubTab === 'rejected') return sortedProducts.filter(p => p.status === 'rejected');
    }
    return [];
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleNumberChange = (text: string, setter: (val: string) => void, field: 'unit' | 'calories') => {
    // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
    const cleanText = text.replace(/[^0-9]/g, '');
    setter(cleanText);
    if (cleanText) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // 說明：關閉彈窗並把相關輸入狀態恢復成初始值。
  const closeAddModal = () => {
    setNewProdName(''); setNewProdUnitValue(''); setNewProdCalories('');
    setErrors({ name: '', unit: '', calories: '' });
    setCancelWarningVisible(false); setAddModalVisible(false);       
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleCancelPress = () => {
    if (newProdName.trim() || newProdUnitValue.trim() || newProdCalories.trim()) {
      setCancelWarningVisible(true);
    } else {
      closeAddModal();
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleAddProduct = async () => {
    let hasError = false;
    // 說明：宣告 newErrors，集中處理這段畫面邏輯會用到的資料或方法。
    const newErrors = { name: '', unit: '', calories: '' };
    if (!newProdName.trim()) { newErrors.name = '請輸入商品名稱'; hasError = true; }
    if (!newProdUnitValue.trim()) { newErrors.unit = '請輸入單位數量'; hasError = true; }
    if (!newProdCalories.trim()) { newErrors.calories = '請輸入熱量'; hasError = true; }
    if (hasError) { setErrors(newErrors); return; }

    // 說明：宣告 finalUnitString，集中處理這段畫面邏輯會用到的資料或方法。
    const finalUnitString = `${newProdUnitValue.trim()}${unitType === 'g' ? '克' : 'ml'}`;
    // 說明：宣告 adminId，集中處理這段畫面邏輯會用到的資料或方法。
    const adminId = await getCurrentAdminId();
    if (!adminId) return;

    closeAddModal();

    try {
      // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
      const response = await fetch(`${API_URL}/products/add/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProdName.trim(), unit: finalUnitString, calories: parseInt(newProdCalories, 10) || 0, member: Number(adminId) }),
      });
      if (response.ok) {
        setActiveTab('audit');
        setAuditSubTab('admin_add');
        await fetchGlobalProducts();
        showMessage('✨ 官方商品已成功新增並入庫！');
      }
    } catch (e) {
      console.log(e);
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleExecuteAction = async () => {
    if (!selectedItem) return;
    
    const { id, action, name, unit } = selectedItem; 
    setConfirmModalVisible(false);

    // 說明：宣告 targetStatus，集中處理這段畫面邏輯會用到的資料或方法。
    const targetStatus = action === 'approve' ? 'approved' : 'rejected';
    setAllProducts(prev => prev.map(p => p.id === id ? { ...p, status: targetStatus } : p));
    showMessage(action === 'approve' ? `✅ 商品「${name} / ${unit}」已核准入庫！` : `❌ 商品「${name} / ${unit}」已拒絕退件！`);

    try {
      // 說明：宣告 adminId，集中處理這段畫面邏輯會用到的資料或方法。
      const adminId = await getCurrentAdminId();
      if (!adminId) return;
      // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
      const response = await fetch(`${API_URL}/products/${id}/${action === 'approve' ? 'approve' : 'reject'}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: Number(adminId) }),
      });
      if (response.ok) await fetchGlobalProducts(true);
    } catch (e) {
      console.log(e);
    } finally {
      setSelectedItem(null);
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleExecuteDelete = async () => {
    if (!deleteItem) return;
    setDeleteModalVisible(false);
    const { id } = deleteItem;
    setDeleteItem(null);

    setAllProducts(prev => prev.filter(p => p.id !== id));
    showMessage('🗑️ 商品已成功刪除！');

    try {
      // 說明：宣告 adminId，集中處理這段畫面邏輯會用到的資料或方法。
      const adminId = await getCurrentAdminId();
      if (!adminId) return;
      // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
      const response = await fetch(`${API_URL}/products/${id}/delete/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: Number(adminId) }),
      });
      if (response.ok) await fetchGlobalProducts(true);
    } catch (e) {
      console.log(e);
    }
  };

  // 說明：存放已經套用篩選條件、準備顯示在畫面上的資料。
  const displayedList = getFilteredProducts();

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainCard}>
          
          <View style={styles.titleSectionRow}>
            <View style={styles.mainTabGroupRow}>
              <Text style={styles.pageTitle}>商 品 管 理 系 統</Text>
              
              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'list' && styles.mainTabButtonActive]} onPress={() => setActiveTab('list')}>
                <Text style={[styles.mainTabLabel, activeTab === 'list' && styles.mainTabLabelActive]}>商品列表</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'user_pending' && styles.mainTabButtonActive]} onPress={() => setActiveTab('user_pending')}>
                <Text style={[styles.mainTabLabel, activeTab === 'user_pending' && styles.mainTabLabelActive]}>待審核</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.mainTabButton, activeTab === 'audit' && styles.mainTabButtonActive]} onPress={() => setActiveTab('audit')}>
                <Text style={[styles.mainTabLabel, activeTab === 'audit' && styles.mainTabLabelActive]}>審核紀錄</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addProductBtn} onPress={() => setAddModalVisible(true)}>
              <Text style={styles.addProductBtnText}>＋ 新增官方商品</Text>
            </TouchableOpacity>
          </View>
          
          {activeTab === 'audit' && (
            <View style={styles.subTabRowWrapper}>
              <View style={styles.subTabLeftGroup}>
                <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'admin_add' && styles.subTabItemActive]} onPress={() => setAuditSubTab('admin_add')}>
                  <Text style={[styles.subTabText, auditSubTab === 'admin_add' && styles.subTabTextActive]}>後台新增</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'approved' && styles.subTabItemActive]} onPress={() => setAuditSubTab('approved')}>
                  <Text style={[styles.subTabText, auditSubTab === 'approved' && styles.subTabTextActive]}>已通過審核</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subTabItem, auditSubTab === 'rejected' && styles.subTabItemActive]} onPress={() => setAuditSubTab('rejected')}>
                  <Text style={[styles.subTabText, auditSubTab === 'rejected' && styles.subTabTextActive]}>未通過審核</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.titleDivider} />
          
          {/* 🕒 核心修改點：優先判斷載入狀態，最後才顯示無資料 */}
          {isLoading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>載入中，請稍候...</Text>
            </View>
          ) : displayedList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>🔍 沒有找到任何相關的商品資料</Text>
            </View>
          ) : (
            displayedList.map((item) => {
              const { displayName, displayUnit } = formatDisplayInfo(item.name, item.unit);
              return (
                <View key={item.id} style={styles.reviewRow}>
                  <View style={styles.infoGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.prodName}>{displayName} / {displayUnit}</Text>
                      <View style={[styles.statusBadge, item.status === 'approved' && styles.badgeApproved, item.status === 'pending' && styles.badgePending, item.status === 'rejected' && styles.badgeRejected]}>
                        <Text style={styles.statusBadgeText}>
                          {item.status === 'approved' && '已上架'}
                          {item.status === 'pending' && '待審核'}
                          {item.status === 'rejected' && '未通過'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.prodCal}>熱量：{item.calories} 大卡</Text>
                    <Text style={styles.contributorText}>{getCreatorSourceText(item)}</Text>
                  </View>

                  <View style={styles.btnGroup}>
                    {item.status === 'pending' ? (
                      <>
                        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => { setSelectedItem({ id: item.id, name: displayName, unit: displayUnit, action: 'reject' }); setConfirmModalVisible(true); }}>
                          <Text style={styles.rejectBtnText}>拒絕退件</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => { setSelectedItem({ id: item.id, name: displayName, unit: displayUnit, action: 'approve' }); setConfirmModalVisible(true); }}>
                          <Text style={styles.approveBtnText}>核准入庫</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => { setDeleteItem({ id: item.id, name: displayName }); setDeleteModalVisible(true); }}>
                        <Text style={styles.deleteBtnText}>- 刪除</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 新增商品彈窗 */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={handleCancelPress}>
        <View style={styles.whiteModalOverlay}>
          <View style={styles.whiteModalContent}>
            <Text style={styles.whiteModalTitle}>新 增 商 品</Text>
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>商品名稱</Text>
              <TextInput style={[styles.whiteBoxInput, !!errors.name && styles.inputErrorBorder]} value={newProdName} onChangeText={(text) => { setNewProdName(text); if(text) setErrors(p => ({ ...p, name: '' })); }} placeholder="例如：御飯糰" placeholderTextColor="#94A3B8" returnKeyType="next" onSubmitEditing={() => unitInputRef.current?.focus()} blurOnSubmit={false} />
              {!!errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>單位</Text>
              <View style={styles.whiteUnitRow}>
                <TextInput ref={unitInputRef} style={[styles.whiteUnderlineInput, !!errors.unit && styles.inputErrorUnderline]} value={newProdUnitValue} onChangeText={(text) => handleNumberChange(text, setNewProdUnitValue, 'unit')} placeholder="限輸入數字" placeholderTextColor="#94A3B8" keyboardType="numeric" returnKeyType="next" onSubmitEditing={() => caloriesInputRef.current?.focus()} blurOnSubmit={false} />
                <View style={styles.capsuleToggleContainer}>
                  <TouchableOpacity style={[styles.capsuleTab, unitType === 'g' && styles.capsuleTabActive]} onPress={() => setUnitType('g')}><Text style={[styles.capsuleTabText, unitType === 'g' && styles.capsuleTabTextActive]}>克</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.capsuleTab, unitType === 'ml' && styles.capsuleTabActive]} onPress={() => setUnitType('ml')}><Text style={[styles.capsuleTabText, unitType === 'ml' && styles.capsuleTabTextActive]}>ml</Text></TouchableOpacity>
                </View>
              </View>
              {!!errors.unit && <Text style={styles.errorText}>{errors.unit}</Text>}
            </View>
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>熱量 (大卡)</Text>
              <TextInput ref={caloriesInputRef} style={[styles.whiteUnderlineInput, !!errors.calories && styles.inputErrorUnderline]} value={newProdCalories} onChangeText={(text) => handleNumberChange(text, setNewProdCalories, 'calories')} placeholder="限輸入數字" placeholderTextColor="#94A3B8" keyboardType="numeric" returnKeyType="done" onSubmitEditing={handleAddProduct} />
              {!!errors.calories && <Text style={styles.errorText}>{errors.calories}</Text>}
            </View>
            <View style={styles.whiteModalActionGroup}>
              <TouchableOpacity style={[styles.whiteRoundBtn, styles.whiteBtnCancel]} onPress={handleCancelPress}><Text style={styles.whiteBtnCancelText}>取 消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.whiteRoundBtn, styles.whiteBtnConfirm]} onPress={handleAddProduct}><Text style={styles.whiteBtnConfirmText}>確 認</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={cancelWarningVisible} onRequestClose={() => setCancelWarningVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.customAlertContent}>
            <Text style={styles.customAlertTitle}>確認取消</Text>
            <Text style={styles.customAlertMessage}>確定要取消新增嗎？內容將不會被儲存。</Text>
            <View style={styles.customAlertButtonGroup}>
              <TouchableOpacity style={styles.customAlertBtnReturn} onPress={() => setCancelWarningVisible(false)}><Text style={styles.customAlertBtnReturnText}>返回</Text></TouchableOpacity>
              <TouchableOpacity style={styles.customAlertBtnConfirm} onPress={closeAddModal}><Text style={styles.customAlertBtnConfirmText}>確定</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 審核彈窗 */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            {selectedItem && (selectedItem.action === 'approve' ? (
              <>
                <Text style={[styles.alertTitle, { color: '#10B981' }]}>📋 確認入庫</Text>
                <Text style={styles.alertMessageText}>
                  是否確認將「{selectedItem?.name} / {selectedItem?.unit}」審核通過並正式入庫上架？
                </Text>
                <View style={styles.modalButtonGroup}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}>
                    <Text style={styles.modalBtnCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#10B981' }]} onPress={handleExecuteAction}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>確認入庫</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.alertTitle, { color: '#E11D48' }]}>⚠️ 拒絕退件確認</Text>
                <Text style={styles.alertMessageText}>
                  拒絕 「{selectedItem?.name} / {selectedItem?.unit}」 是否確認刪除（退回）？
                </Text>
                <View style={styles.modalButtonGroup}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}>
                    <Text style={styles.modalBtnCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#E11D48' }]} onPress={handleExecuteAction}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>確認拒絕</Text>
                  </TouchableOpacity>
                </View>
              </>
            ))}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#F43F5E' }]}>警告</Text>
            <Text style={{ fontSize: 16, marginVertical: 15 }}>確定要從資料庫刪除「{deleteItem?.name}」的紀錄嗎？</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setDeleteModalVisible(false)}><Text style={styles.modalBtnCancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F43F5E' }]} onPress={handleExecuteDelete}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>確定刪除</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  scrollContent: { paddingVertical: 30, alignItems: 'center' },
  mainCard: { backgroundColor: 'white', width: '95%', minHeight: 600, borderRadius: 16, padding: 30, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10 },
  titleSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mainTabGroupRow: { flexDirection: 'row', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginRight: 30 },
  mainTabButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, marginRight: 8 },
  mainTabButtonActive: { backgroundColor: '#1E293B' },
  mainTabLabel: { fontSize: 15, color: '#64748B', fontWeight: '600' },
  mainTabLabelActive: { color: 'white' },
  subTabRowWrapper: { flexDirection: 'row', marginTop: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 5 },
  subTabLeftGroup: { flexDirection: 'row' },
  subTabItem: { paddingVertical: 8, paddingHorizontal: 14, marginRight: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  subTabItemActive: { borderBottomColor: '#FF6B35' },
  subTabText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  subTabTextActive: { color: '#FF6B35', fontWeight: 'bold' },
  addProductBtn: { backgroundColor: '#0284C7', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  addProductBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  titleDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 15 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 15, color: '#94A3B8' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoGroup: { flex: 1 },
  prodName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  prodCal: { fontSize: 14, color: '#475569', marginTop: 2 },
  contributorText: { fontSize: 13, color: '#64748B', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 10, backgroundColor: '#F1F5F9' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeApproved: { backgroundColor: '#DCFCE7' },
  badgeRejected: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  btnGroup: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginLeft: 10 },
  rejectBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E11D48' },
  rejectBtnText: { color: '#E11D48', fontSize: 13, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#10B981' },
  approveBtnText: { color: 'white', fontSize: 13, fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#FFF1F2' },
  deleteBtnText: { color: '#F43F5E', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  
  alertContent: { backgroundColor: '#FFF', width: 440, padding: 25, borderRadius: 16, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold' },
  alertMessageText: { fontSize: 16, marginVertical: 18, textAlign: 'center', lineHeight: 24, color: '#334155' },
  
  modalButtonGroup: { flexDirection: 'row', marginTop: 15 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6, marginHorizontal: 5 },
  modalBtnCancel: { backgroundColor: '#E2E8F0' },
  modalBtnCancelText: { color: '#475569' },

  whiteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  whiteModalContent: { backgroundColor: '#FFFFFF', width: 440, padding: 35, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  whiteModalTitle: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textAlign: 'center', marginBottom: 25, letterSpacing: 2 },
  whiteInputBlock: { width: '100%', marginBottom: 15 },
  whiteInputLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  whiteBoxInput: { width: '100%', fontSize: 15, color: '#334155', borderWidth: 2, borderColor: '#000000', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  whiteUnitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whiteUnderlineInput: { flex: 1, fontSize: 15, color: '#334155', borderBottomWidth: 1, borderBottomColor: '#94A3B8', paddingVertical: 4, marginRight: 15 },
  capsuleToggleContainer: { flexDirection: 'row', width: 120, height: 32, borderWidth: 1, borderColor: '#94A3B8', borderRadius: 8, overflow: 'hidden' },
  capsuleTab: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  capsuleTabActive: { backgroundColor: '#94A3B8' },
  capsuleTabText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  capsuleTabTextActive: { color: '#FFFFFF' },
  whiteModalActionGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  whiteRoundBtn: { flex: 1, height: 44, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  whiteBtnCancel: { borderColor: '#000000', backgroundColor: '#FFFFFF', marginRight: 10 },
  whiteBtnCancelText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  whiteBtnConfirm: { borderColor: '#0284C7', backgroundColor: '#0284C7', marginLeft: 10 },
  whiteBtnConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  errorText: { color: '#E11D48', fontSize: 13, marginTop: 5, fontWeight: '500' },
  inputErrorBorder: { borderColor: '#E11D48' },
  inputErrorUnderline: { borderBottomColor: '#E11D48' },

  customAlertContent: { backgroundColor: '#FFFFFF', width: 400, paddingHorizontal: 30, paddingVertical: 25, borderRadius: 24, alignItems: 'center' },
  customAlertTitle: { fontSize: 22, fontWeight: 'bold', color: '#333333', marginBottom: 15 },
  customAlertMessage: { fontSize: 16, color: '#555555', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  customAlertButtonGroup: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  customAlertBtnReturn: { flex: 1, height: 46, borderWidth: 2, borderColor: '#000000', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: '#FFFFFF' },
  customAlertBtnReturnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  customAlertBtnConfirm: { flex: 1, height: 46, backgroundColor: '#E67E22', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  customAlertBtnConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});