import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
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
  creatorRole?: string;
  creatorUsername?: string;
}

const parseApiResponse = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
  }
};

const getCreatorIdFromApi = (item: any) => {
  if (item.creator_id !== null && item.creator_id !== undefined) return String(item.creator_id);
  if (item.creator && typeof item.creator === 'object' && item.creator.id !== undefined) return String(item.creator.id);
  if (item.creator !== null && item.creator !== undefined) return String(item.creator);
  return '';
};

const getCreatorRoleFromApi = (item: any) => {
  if (item.creator_role) return String(item.creator_role);
  if (item.creatorRole) return String(item.creatorRole);
  if (item.creator && typeof item.creator === 'object' && item.creator.role) return String(item.creator.role);
  return '';
};

const getCreatorUsernameFromApi = (item: any) => {
  if (item.creator_username) return String(item.creator_username);
  if (item.creatorUsername) return String(item.creatorUsername);
  if (item.creator && typeof item.creator === 'object' && item.creator.username) return String(item.creator.username);
  return '';
};

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

const getCreatorSourceText = (item: Product) => {
  const creatorId = item.creatorId || 'guest';
  const creatorRole = String(item.creatorRole || '').toLowerCase();
  const roleText = creatorRole === 'admin' ? '管理者' : '使用者';
  return `商品來源：${creatorId} (${roleText})`;
};

const showMessage = (message: string) => {
  if (Platform.OS === 'web') window.alert(message);
};

export default function AdminReviewScreen() {
  
  const [currentUserId, setCurrentUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'user_pending' | 'audit'>('list'); 
  const [auditSubTab, setAuditSubTab] = useState<'admin_add' | 'approved' | 'rejected'>('admin_add');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  // 🛠️ 擴充 selectedItem 結構，完整保存品名 (name) 與單位 (unit)
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

  const isFetchingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const unitInputRef = useRef<TextInput>(null);
  const caloriesInputRef = useRef<TextInput>(null);

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
    if (cleanUnit.includes('/')) {
      const unitParts = cleanUnit.split('/');
      if (unitParts[0].trim() === unitParts[1].trim()) {
        cleanUnit = unitParts[0].trim();
      }
    }
    return { displayName: cleanName || '未命名商品', displayUnit: cleanUnit };
  };

  const getCurrentAdminId = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const savedId = currentUser?.id?.toString?.() || await AsyncStorage.getItem('current_user_id') || '';
      return /^\d+$/.test(savedId) ? savedId : '';
    } catch (e) {
      return '';
    }
  };

  const fetchGlobalProducts = async (isBackground = false) => {
    if (isFetchingRef.current) return; 
    isFetchingRef.current = true;

    try {
      const t = Date.now();
      const [approvedRes, pendingRes, rejectedRes] = await Promise.all([
        fetch(`${API_URL}/products/?t=${t}`),
        fetch(`${API_URL}/products/pending/?t=${t}`),
        fetch(`${API_URL}/products/rejected/?t=${t}`),
      ]);

      const approvedData = await parseApiResponse(approvedRes);
      const pendingData = await parseApiResponse(pendingRes);
      const rejectedData = await parseApiResponse(rejectedRes);

      if (!approvedRes.ok || !pendingRes.ok || !rejectedRes.ok) throw new Error('讀取失敗');

      const mergedMap = new Map<string, Product>();
      // 🛠️ 同樣修正順序：Pending 先放，讓 Approved/Rejected 擁有最後決定權
      (Array.isArray(pendingData) ? pendingData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));
      (Array.isArray(rejectedData) ? rejectedData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));
      (Array.isArray(approvedData) ? approvedData : []).forEach(item => mergedMap.set(String(item.id), mapProductFromApi(item)));

      const mergedList = Array.from(mergedMap.values());

      // 🛠️ 強化：防閃爍 (Anti-flicker) 邏輯
      // 如果後端抓回來的狀態還是 'pending'，但本地已經標記為 'approved' 或 'rejected'，
      // 則優先保留本地狀態。這能避免後端資料庫尚未同步完成前導致的「資料跳回」現象。
      setAllProducts(prev => {
        return mergedList.map(newItem => {
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
    }
  };

  // 🛠️ 核心修正：雙軌制即時監聽與動態刷新定時器
  // 在待審核頁面且沒打開彈窗時，採用 0.1 秒極速輪詢刷新；同時維持 WebSocket 連線監聽
  useEffect(() => {
    getCurrentAdminId().then(id => { if (id) setCurrentUserId(id); });
    fetchGlobalProducts(false);

    // 建立隨時通訊的 WebSocket
    const connectWebSocket = () => {
      console.log('正在建立即時刷新 WebSocket 連線...');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
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

    // 🕒 調整自動刷新頻率。因為已有 WebSocket 即時監聽，輪詢建議降至 3 秒一次。
    // 避免過快頻率 (如 0.1秒) 在資料庫更新尚未完全反映時抓到舊資料，導致「消失後又出現」的閃爍現象。
    const refreshInterval = 3000;

    const pollingTimer = setInterval(() => {
      fetchGlobalProducts(true); 
    }, refreshInterval);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pollingTimer);
    };
  }, [activeTab]); // 僅在切換標籤時重新初始化，移除彈窗狀態依賴，防止操作後立即觸發刷新

  const getFilteredProducts = () => {
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

  const handleNumberChange = (text: string, setter: (val: string) => void, field: 'unit' | 'calories') => {
    const cleanText = text.replace(/[^0-9]/g, '');
    setter(cleanText);
    if (cleanText) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const closeAddModal = () => {
    setNewProdName(''); setNewProdUnitValue(''); setNewProdCalories('');
    setErrors({ name: '', unit: '', calories: '' });
    setCancelWarningVisible(false); setAddModalVisible(false);       
  };

  const handleCancelPress = () => {
    if (newProdName.trim() || newProdUnitValue.trim() || newProdCalories.trim()) {
      setCancelWarningVisible(true);
    } else {
      closeAddModal();
    }
  };

  const handleAddProduct = async () => {
    let hasError = false;
    const newErrors = { name: '', unit: '', calories: '' };
    if (!newProdName.trim()) { newErrors.name = '請輸入商品名稱'; hasError = true; }
    if (!newProdUnitValue.trim()) { newErrors.unit = '請輸入單位數量'; hasError = true; }
    if (!newProdCalories.trim()) { newErrors.calories = '請輸入熱量'; hasError = true; }
    if (hasError) { setErrors(newErrors); return; }

    const finalUnitString = `${newProdUnitValue.trim()}${unitType === 'g' ? '克' : 'ml'}`;
    const adminId = await getCurrentAdminId();
    if (!adminId) return;

    closeAddModal();

    try {
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

  const handleExecuteAction = async () => {
    if (!selectedItem) return;
    setConfirmModalVisible(false);
    const { id, action, name, unit } = selectedItem;
    setSelectedItem(null);

    const targetStatus = action === 'approve' ? 'approved' : 'rejected';
    setAllProducts(prev => prev.map(p => p.id === id ? { ...p, status: targetStatus } : p));
    showMessage(action === 'approve' ? `✅ 商品「${name} / ${unit}」已核准入庫！` : `❌ 商品「${name} / ${unit}」已拒絕退件！`);

    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) return;
      const response = await fetch(`${API_URL}/products/${id}/${action === 'approve' ? 'approve' : 'reject'}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: Number(adminId) }),
      });
      if (response.ok) await fetchGlobalProducts(true);
    } catch (e) {
      console.log(e);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteItem) return;
    setDeleteModalVisible(false);
    const { id } = deleteItem;
    setDeleteItem(null);

    setAllProducts(prev => prev.filter(p => p.id !== id));
    showMessage('🗑️ 商品已成功刪除！');

    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) return;
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

  const displayedList = getFilteredProducts();

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
          
          {displayedList.length === 0 ? (
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
                        {/* 🛠️ 點擊傳入完整的品名與單位 */}
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

      {/* 🛠️ 核心修改：動態整合審核彈窗（精準印出品名與單位） */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            {selectedItem?.action === 'approve' ? (
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
            )}
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
  
  // 🛠️ 稍微拓寬彈窗寬度到 440，確保品名、單位與「是否確認刪除（退回）？」能完美排版呈現
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