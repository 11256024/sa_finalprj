import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending' | 'rejected'; 
  creatorId?: string; // 儲存登入的帳號 ID
}

export default function AdminReviewScreen() {
  
  // 🌟 模擬目前登入的管理者帳號 ID (實務上通常從 Auth Context 或 Redux/Zustand 取得)
  const currentUserId = 'admin_jack123'; 

  // 主分頁狀態：'list' (商品列表) | 'user_pending' (待審核) | 'audit' (審核紀錄)
  const [activeTab, setActiveTab] = useState<'list' | 'user_pending' | 'audit'>('user_pending'); 
  
  // 審核紀錄子分頁：'admin_add' (後台新增) | 'approved' (已通過) | 'rejected' (未通過)
  const [auditSubTab, setAuditSubTab] = useState<'admin_add' | 'approved' | 'rejected'>('admin_add');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  // 彈窗狀態控制
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; action: 'approve' | 'reject' } | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);

  // 新增商品彈窗狀態與欄位
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnitValue, setNewProdUnitValue] = useState(''); 
  const [unitType, setUnitType] = useState<'g' | 'ml'>('g');     
  const [newProdCalories, setNewProdCalories] = useState('');

  // 🔴 欄位防呆錯誤狀態
  const [errors, setErrors] = useState({ name: '', unit: '', calories: '' });

  // ⌨️ 用於 Enter 切換焦點的 Ref 指標
  const unitInputRef = useRef<TextInput>(null);
  const caloriesInputRef = useRef<TextInput>(null);

  // 撈取資料
  const fetchGlobalProducts = () => {
    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        setAllProducts(JSON.parse(storedProducts));
      } else {
        // 初始測試資料：將原本寫死的官方管理員改成動態的管理者帳號 ID
        const dummy: Product[] = [
          { id: '1', name: '雞胸肉沙拉', unit: '200克', calories: 180, status: 'pending', creatorId: 'user_marry55' },
          { id: '2', name: '御飯糰', unit: '100克', calories: 210, status: 'approved', creatorId: currentUserId }
        ];
        localStorage.setItem('global_products', JSON.stringify(dummy));
        setAllProducts(dummy);
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      fetchGlobalProducts();
    }
  }, []);

  // 🌟 修正過濾邏輯：全面改用動態的 currentUserId 進行判定
  const getFilteredProducts = () => {
    const reversedProducts = [...allProducts].reverse();

    if (activeTab === 'list') {
      return reversedProducts.filter(p => p.status === 'approved');
    } 
    
    if (activeTab === 'user_pending') {
      // 待審核：狀態為 pending，且建立者「不是」當前登入的管理者
      return reversedProducts.filter(p => p.status === 'pending' && p.creatorId !== currentUserId);
    }

    // 審核紀錄主分頁下的子分類
    if (auditSubTab === 'admin_add') {
      // 後台新增：建立者「是」當前登入的管理者
      return reversedProducts.filter(p => p.creatorId === currentUserId);
    } else if (auditSubTab === 'approved') {
      // 已通過審核：已被核准上架，且原本是「其他使用者」提交的商品
      return reversedProducts.filter(p => p.status === 'approved' && p.creatorId !== currentUserId);
    } else {
      // 未通過審核：被退件拒絕的商品
      return reversedProducts.filter(p => p.status === 'rejected');
    }
  };

  // 處理單位與熱量的數字輸入限制
  const handleNumberChange = (text: string, setter: (val: string) => void, field: 'unit' | 'calories') => {
    const cleanText = text.replace(/[^0-9]/g, '');
    setter(cleanText);
    if (cleanText) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 關閉新增彈窗並重置
  const closeAddModal = () => {
    setNewProdName('');
    setNewProdUnitValue('');
    setNewProdCalories('');
    setErrors({ name: '', unit: '', calories: '' });
    setAddModalVisible(false);
  };

  // 送出新增官方商品
  const handleAddProduct = () => {
    let hasError = false;
    const newErrors = { name: '', unit: '', calories: '' };

    if (!newProdName.trim()) {
      newErrors.name = '請輸入商品名稱';
      hasError = true;
    }
    if (!newProdUnitValue.trim()) {
      newErrors.unit = '請輸入單位數量';
      hasError = true;
    }
    if (!newProdCalories.trim()) {
      newErrors.calories = '請輸入熱量';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    const unitLabel = unitType === 'g' ? '克' : 'ml';
    const finalUnitString = `${newProdUnitValue.trim()}${unitLabel}`;

    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      let products: Product[] = storedProducts ? JSON.parse(storedProducts) : [];

      // 🌟 新增商品時，將 creatorId 綁定為當前登入的帳號 ID (currentUserId)
      const newProduct: Product = {
        id: `admin_add_${Date.now()}`,
        name: newProdName.trim(),
        unit: finalUnitString,
        calories: parseInt(newProdCalories, 10) || 0,
        status: 'approved', 
        creatorId: currentUserId 
      };

      products.push(newProduct);
      localStorage.setItem('global_products', JSON.stringify(products));
      setAllProducts(products);
    }

    closeAddModal();
    // 管理者新增完後，自動導向審核紀錄中的「後台新增」標籤查看
    setActiveTab('audit');
    setAuditSubTab('admin_add');
  };

  const handleExecuteAction = () => {
    if (!selectedItem) return;
    const { id, action } = selectedItem;
    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        let products: Product[] = JSON.parse(storedProducts);
        products = products.map(p => p.id === id ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' } : p);
        localStorage.setItem('global_products', JSON.stringify(products));
        setAllProducts(products);
      }
    }
    setConfirmModalVisible(false);
    setSelectedItem(null);
  };

  const handleExecuteDelete = () => {
    if (!deleteItem) return;
    const { id } = deleteItem;
    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        let products: Product[] = JSON.parse(storedProducts);
        products = products.filter(p => p.id !== id);
        localStorage.setItem('global_products', JSON.stringify(products));
        setAllProducts(products);
      }
    }
    setDeleteModalVisible(false);
    setDeleteItem(null);
  };

  const displayedList = getFilteredProducts();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainCard}>
          
          {/* 頂部主列 */}
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
          
          {/* 審核紀錄子分頁 */}
          {activeTab === 'audit' && (
            <View style={styles.subTabRowWrapper}>
              <View style={styles.subTabLeftGroup}>
                <TouchableOpacity 
                  style={[styles.subTabItem, auditSubTab === 'admin_add' && styles.subTabItemActive]} 
                  onPress={() => setAuditSubTab('admin_add')}
                >
                  <Text style={[styles.subTabText, auditSubTab === 'admin_add' && styles.subTabTextActive]}>
                    後台新增
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.subTabItem, auditSubTab === 'approved' && styles.subTabItemActive]} 
                  onPress={() => setAuditSubTab('approved')}
                >
                  <Text style={[styles.subTabText, auditSubTab === 'approved' && styles.subTabTextActive]}>
                    已通過審核
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.subTabItem, auditSubTab === 'rejected' && styles.subTabItemActive]} 
                  onPress={() => setAuditSubTab('rejected')}
                >
                  <Text style={[styles.subTabText, auditSubTab === 'rejected' && styles.subTabTextActive]}>
                    未通過審核
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.titleDivider} />
          
          {/* 列表渲染 */}
          {displayedList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>🔍 沒有找到任何相關的商品資料</Text>
            </View>
          ) : (
            displayedList.map((item) => (
              <View key={item.id} style={styles.reviewRow}>
                <View style={styles.infoGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.prodName}>{item.name}</Text>
                    <View style={[styles.statusBadge, item.status === 'approved' && styles.badgeApproved, item.status === 'pending' && styles.badgePending, item.status === 'rejected' && styles.badgeRejected]}>
                      <Text style={styles.statusBadgeText}>
                        {item.status === 'approved' && '已上架'}
                        {item.status === 'pending' && '待審核'}
                        {item.status === 'rejected' && '未通過'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.prodCal}>熱量：{item.calories} 大卡</Text>
                  
                  {/* 🌟 修正商品來源：如果是目前登入的管理者，顯示目前的 id (管理者)；其餘則顯示對應帳號 (使用者) */}
                  <Text style={styles.contributorText}>
                    商品來源：{item.creatorId === currentUserId ? `${item.creatorId} (管理者)` : `${item.creatorId || '未知帳號'} (使用者)`}
                  </Text>
                </View>

                <View style={styles.btnGroup}>
                  {item.status === 'pending' ? (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => { setSelectedItem({ id: item.id, name: item.name, action: 'reject' }); setConfirmModalVisible(true); }}>
                        <Text style={styles.rejectBtnText}>拒絕退件</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => { setSelectedItem({ id: item.id, name: item.name, action: 'approve' }); setConfirmModalVisible(true); }}>
                        <Text style={styles.approveBtnText}>核准入庫</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => { setDeleteItem({ id: item.id, name: item.name }); setDeleteModalVisible(true); }}>
                      <Text style={styles.deleteBtnText}>- 刪除</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 新增官方商品彈窗 */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={closeAddModal}>
        <View style={styles.whiteModalOverlay}>
          <View style={styles.whiteModalContent}>
            <Text style={styles.whiteModalTitle}>新 增 商 品</Text>
            
            {/* 1. 商品名稱 */}
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>商品名稱</Text>
              <TextInput 
                style={[styles.whiteBoxInput, !!errors.name && styles.inputErrorBorder]} 
                value={newProdName} 
                onChangeText={(text) => { setNewProdName(text); if(text) setErrors(p => ({ ...p, name: '' })); }} 
                placeholder="例如：御飯糰" 
                placeholderTextColor="#94A3B8"
                returnKeyType="next"
                onSubmitEditing={() => unitInputRef.current?.focus()}
                blurOnSubmit={false}
              />
              {!!errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>
            
            {/* 2. 單位 */}
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>單位</Text>
              <View style={styles.whiteUnitRow}>
                <TextInput 
                  ref={unitInputRef}
                  style={[styles.whiteUnderlineInput, !!errors.unit && styles.inputErrorUnderline]} 
                  value={newProdUnitValue} 
                  onChangeText={(text) => handleNumberChange(text, setNewProdUnitValue, 'unit')} 
                  placeholder="限輸入數字" 
                  placeholderTextColor="#94A3B8" 
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => caloriesInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <View style={styles.capsuleToggleContainer}>
                  <TouchableOpacity style={[styles.capsuleTab, unitType === 'g' && styles.capsuleTabActive]} onPress={() => setUnitType('g')}>
                    <Text style={[styles.capsuleTabText, unitType === 'g' && styles.capsuleTabTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.capsuleTab, unitType === 'ml' && styles.capsuleTabActive]} onPress={() => setUnitType('ml')}>
                    <Text style={[styles.capsuleTabText, unitType === 'ml' && styles.capsuleTabTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!!errors.unit && <Text style={styles.errorText}>{errors.unit}</Text>}
            </View>
            
            {/* 3. 熱量 */}
            <View style={styles.whiteInputBlock}>
              <Text style={styles.whiteInputLabel}>熱量 (大卡)</Text>
              <TextInput 
                ref={caloriesInputRef}
                style={[styles.whiteUnderlineInput, !!errors.calories && styles.inputErrorUnderline]} 
                value={newProdCalories} 
                onChangeText={(text) => handleNumberChange(text, setNewProdCalories, 'calories')} 
                placeholder="限輸入數字" 
                placeholderTextColor="#94A3B8" 
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleAddProduct}
              />
              {!!errors.calories && <Text style={styles.errorText}>{errors.calories}</Text>}
            </View>
            
            <View style={styles.whiteModalActionGroup}>
              <TouchableOpacity style={[styles.whiteRoundBtn, styles.whiteBtnCancel]} onPress={closeAddModal}>
                <Text style={styles.whiteBtnCancelText}>取 消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.whiteRoundBtn, styles.whiteBtnConfirm]} onPress={handleAddProduct}>
                <Text style={styles.whiteBtnConfirmText}>確 認</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 審核確認視窗 */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, selectedItem?.action === 'approve' ? { color: '#10B981' } : { color: '#E11D48' }]}>
              {selectedItem?.action === 'approve' ? '核准入庫確認' : '拒絕退件確認'}
            </Text>
            <Text style={{ fontSize: 16, marginVertical: 15 }}>確定要處理使用者送出的「{selectedItem?.name}」嗎？</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}><Text style={styles.modalBtnCancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: selectedItem?.action === 'approve' ? '#10B981' : '#E11D48' }]} onPress={handleExecuteAction}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>確定</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 刪除確認視窗 */}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 16, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold' },
  modalButtonGroup: { flexDirection: 'row', marginTop: 15 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6, marginHorizontal: 5 },
  modalBtnCancel: { backgroundColor: '#E2E8F0' },
  modalBtnCancelText: { color: '#475569' },

  // 純白風格視窗樣式
  whiteModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
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
  
  // 防呆提示專用樣式
  errorText: { color: '#E11D48', fontSize: 13, marginTop: 5, fontWeight: '500' },
  inputErrorBorder: { borderColor: '#E11D48' },
  inputErrorUnderline: { borderBottomColor: '#E11D48' }
});