import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending';
}

export default function AdminReviewScreen() {
  const router = useRouter();
  
  // 預設改為空陣列，完全交由動態載入
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  // 審核彈窗狀態
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; action: 'approve' | 'reject' } | null>(null);

  // 新增商品彈窗狀態
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('');
  const [newProdCalories, setNewProdCalories] = useState('');

  // 刪除商品防呆彈窗狀態
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);

  // 點擊取消新增時的防呆彈窗狀態
  const [cancelAddModalVisible, setCancelAddModalVisible] = useState(false);

  // 🎯 獨立出來的純撈取資料函式
  const fetchGlobalProducts = () => {
    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        setAllProducts(JSON.parse(storedProducts));
      } else {
        setAllProducts([]);
      }
    }
  };

  // 載入時檢查登入權限與動態撈取使用者送審的商品
  const checkAuthAndLoadProducts = () => {
    if (Platform.OS === 'web') {
      // 🔒 安全檢查：防偷跑
      const loginStatus = localStorage.getItem('admin_logged_in');
      if (loginStatus !== 'true') {
        window.alert('⚠️ 您尚未登入管理員帳號！');
        router.replace('/'); 
        return false;
      }
      
      fetchGlobalProducts();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const isAuthed = checkAuthAndLoadProducts();
    if (!isAuthed) return;

    if (Platform.OS === 'web') {
      // 🔥 核心雙向同步機制 A：監聽跨分頁的 localStorage 變動
      // 當使用者在另一個分頁/視窗按了「送出審核」，這裡會「秒速」被通知，免整理跳出待審核商品
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'global_products') {
          fetchGlobalProducts();
        }
      };

      // 🔥 核心雙向同步機制 B：監聽當前瀏覽器分頁被聚焦（Focus）
      // 當測試時在同一個分頁的不同路由（網址）切換回來時，強迫重新整理抓取最新快取
      const handleWindowFocus = () => {
        fetchGlobalProducts();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', handleWindowFocus);

      // 卸載時移除監聽釋放記憶體
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', handleWindowFocus);
      };
    }
  }, []);

  // 觸發審核彈窗
  const triggerConfirm = (id: string, name: string, action: 'approve' | 'reject') => {
    setSelectedItem({ id, name, action });
    setConfirmModalVisible(true);
  };

  // 觸發刪除防呆彈窗
  const triggerDeleteConfirm = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setDeleteModalVisible(true);
  };

  // 觸發「取消新增」的防呆檢查
  const handleCancelAddClick = () => {
    if (!newProdName.trim() && !newProdUnit.trim() && !newProdCalories.trim()) {
      setAddModalVisible(false);
    } else {
      setCancelAddModalVisible(true);
    }
  };

  // 確認要放棄新增商品
  const handleConfirmAbandonAdd = () => {
    setNewProdName('');
    setNewProdUnit('');
    setNewProdCalories('');
    setCancelAddModalVisible(false);
    setAddModalVisible(false);
  };

  // 執行審核動作（核准上架 / 拒絕退件）
  const handleExecuteAction = () => {
    if (!selectedItem) return;
    const { id, action } = selectedItem;

    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        let products: Product[] = JSON.parse(storedProducts);
        
        if (action === 'reject') {
          // 拒絕退件：直接從全局資料庫中拔除該筆使用者申請
          products = products.filter(p => p.id !== id);
        } else {
          // 核准入庫：將 status 從 'pending' 翻轉為 'approved'
          // 🌟 這時因為改變了 status，使用者端那邊會立刻偵測到並在搜尋列表中「產生新商品」！
          products = products.map(p => p.id === id ? { ...p, status: 'approved' } : p);
        }
        
        // 回寫快取，同步更新管理員畫面上的狀態
        localStorage.setItem('global_products', JSON.stringify(products));
        setAllProducts(products);
      }
    }
    setConfirmModalVisible(false);
    setSelectedItem(null);
  };

  // 執行刪除商品
  const handleExecuteDelete = () => {
    if (!deleteItem) return;
    const { id, name } = deleteItem;

    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        let products: Product[] = JSON.parse(storedProducts);
        products = products.filter(p => p.id !== id);
        localStorage.setItem('global_products', JSON.stringify(products));
        setAllProducts(products);
        window.alert(`商品「${name}」已成功刪除！`);
      }
    }
    setDeleteModalVisible(false);
    setDeleteItem(null);
  };

  // 管理員直接新增官方商品（預設直接 status: 'approved' 免審核）
  const handleAddProduct = () => {
    if (!newProdName.trim() || !newProdUnit.trim() || !newProdCalories.trim()) {
      if (Platform.OS === 'web') window.alert("請完整填寫所有商品欄位！");
      return;
    }

    const caloriesNum = parseInt(newProdCalories, 10);
    if (isNaN(caloriesNum)) {
      if (Platform.OS === 'web') window.alert("熱量請輸入有效的數字！");
      return;
    }

    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      let products: Product[] = storedProducts ? JSON.parse(storedProducts) : [];

      const newProduct: Product = {
        id: `admin_add_${Date.now()}`,
        name: newProdName.trim(),
        unit: newProdUnit.trim(),
        calories: caloriesNum,
        status: 'approved' // 🌟 管理員直接新增商品，狀態直接設為 approved，使用者那裏就能立刻看見
      };

      products.push(newProduct);
      localStorage.setItem('global_products', JSON.stringify(products));
      setAllProducts(products);
      window.alert(`成功新增官方商品：「${newProdName}」！`);
    }

    setNewProdName('');
    setNewProdUnit('');
    setNewProdCalories('');
    setAddModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainCard}>
          <View style={styles.titleSectionRow}>
            <Text style={styles.pageTitle}>商 品 管 理 與 審 核</Text>
            <TouchableOpacity style={styles.addProductBtn} onPress={() => setAddModalVisible(true)}>
              <Text style={styles.addProductBtnText}>➕ 新增官方商品</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.titleDivider} />
          
          {allProducts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>🎉 目前沒有任何商品資料唷！</Text>
              <Text style={styles.emptySubText}>當使用者提交新商品，或管理員手動新增時，資料將會即時顯示在此處。</Text>
            </View>
          ) : (
            allProducts.map((item) => (
              <View key={item.id} style={styles.reviewRow}>
                <View style={styles.infoGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.prodName}>{item.name} / {item.unit}</Text>
                    <View style={[styles.statusBadge, item.status === 'approved' ? styles.badgeApproved : styles.badgePending]}>
                      <Text style={styles.statusBadgeText}>{item.status === 'approved' ? '已上架' : '待審核'}</Text>
                    </View>
                  </View>
                  <Text style={styles.prodCal}>熱量：{item.calories} 大卡</Text>
                  <Text style={styles.contributorText}>商品 ID: {item.id}</Text>
                </View>

                <View style={styles.btnGroup}>
                  {item.status === 'pending' ? (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => triggerConfirm(item.id, item.name, 'reject')}>
                        <Text style={styles.rejectBtnText}>拒絕退件</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => triggerConfirm(item.id, item.name, 'approve')}>
                        <Text style={styles.approveBtnText}>核准入庫</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => triggerDeleteConfirm(item.id, item.name)}>
                      <Text style={styles.deleteBtnText}>🗑️ 刪除商品</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 新增官方商品彈窗 (Modal) */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={handleCancelAddClick}>
        <View style={styles.modalOverlay}>
          <View style={styles.addAlertContent}>
            <Text style={styles.addAlertTitle}>新增官方入庫商品</Text>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>商品名稱</Text>
              <TextInput style={styles.modalInputField} value={newProdName} onChangeText={setNewProdName} placeholder="例如：鮮肉燕餃" />
            </View>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>單位 (如：一包、100g)</Text>
              <TextInput style={styles.modalInputField} value={newProdUnit} onChangeText={setNewProdUnit} placeholder="例如：一盒" />
            </View>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>卡路里熱量 (大卡)</Text>
              <TextInput style={styles.modalInputField} value={newProdCalories} onChangeText={setNewProdCalories} keyboardType="numeric" placeholder="例如：240" />
            </View>
            <View style={[styles.modalButtonGroup, { marginTop: 15 }]}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={handleCancelAddClick}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00C853' }]} onPress={handleAddProduct}>
                <Text style={styles.modalBtnConfirmText}>確認新增</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 取消填寫商品時的「防呆確認彈窗」 */}
      <Modal animationType="fade" transparent={true} visible={cancelAddModalVisible} onRequestClose={() => setCancelAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#F39C12' }]}>⚠️ 確定取消新增？</Text>
            <View style={styles.messageContainer}>
              <Text style={styles.alertMessage}>您目前填寫的商品資訊尚未儲存，</Text>
              <Text style={styles.alertMessage}>離開後輸入的內容將會<Text style={{ fontWeight: 'bold', color: '#E74C3C' }}>全部清空</Text>。</Text>
            </View>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setCancelAddModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>繼續填寫</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F39C12' }]} onPress={handleConfirmAbandonAdd}>
                <Text style={styles.modalBtnConfirmText}>放棄並離開</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 刪除商品防呆確認彈窗 (Modal) */}
      <Modal animationType="fade" transparent={true} visible={deleteModalVisible} onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: '#E74C3C' }]}>⚠️ 確定刪除此商品？</Text>
            <View style={styles.messageContainer}>
              <Text style={styles.alertMessage}>您即將從系統中永久刪除商品：</Text>
              <Text style={[styles.productHighlight, { color: '#E74C3C' }]}>「{deleteItem?.name}」</Text>
              <Text style={styles.alertSubMessage}>注意：刪除後資料將無法復原，使用者也將無法再搜尋到此商品。</Text>
            </View>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#E74C3C' }]} onPress={handleExecuteDelete}>
                <Text style={styles.modalBtnConfirmText}>確認刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 審核防呆彈窗 (Modal) */}
      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, selectedItem?.action === 'approve' ? { color: '#00C853' } : { color: '#F39C12' }]}>
              {selectedItem?.action === 'reject' ? '⚠️ 確認要拒絕退件嗎？' : '💡 確認要核准入庫嗎？'}
            </Text>
            <View style={styles.messageContainer}>
              <Text style={styles.alertMessage}>您即將{selectedItem?.action === 'reject' ? '「拒絕並刪除」' : '「核准並上架」'}商品：</Text>
              <Text style={styles.productHighlight}>「{selectedItem?.name}」</Text>
              <Text style={styles.alertSubMessage}>
                {selectedItem?.action === 'reject' ? '退件後，該商品資料將會從審核隊列中永久移除。' : '通過後，該商品將正式進入官方資料庫，所有使用者皆可查詢。'}
              </Text>
            </View>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, selectedItem?.action === 'reject' ? styles.modalBtnRejectConfirm : styles.modalBtnApproveConfirm]} onPress={handleExecuteAction}>
                <Text style={styles.modalBtnConfirmText}>確定執行</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFF2F5' },
  scrollContent: { paddingVertical: 40, alignItems: 'center' },
  mainCard: { backgroundColor: 'white', width: '90%', minHeight: 600, borderRadius: 16, padding: 40, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  titleSectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#2C3E50', letterSpacing: 2 },
  addProductBtn: { backgroundColor: '#3498DB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  addProductBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  titleDivider: { height: 1, backgroundColor: '#E0E0E0', marginTop: 15, marginBottom: 30 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#7F8C8D', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#95A5A6', textAlign: 'center', lineHeight: 20 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  infoGroup: { flex: 1 },
  prodName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  prodCal: { fontSize: 14, color: '#666', marginBottom: 4 },
  contributorText: { fontSize: 12, color: '#BDC3C7' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 10 },
  badgePending: { backgroundColor: '#FFEAA7' },
  badgeApproved: { backgroundColor: '#D4EDDA' },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  btnGroup: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginLeft: 12 },
  rejectBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E74C3C' },
  rejectBtnText: { color: '#E74C3C', fontSize: 14, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#00C853' },
  approveBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#E74C3C' },
  deleteBtnText: { color: '#E74C3C', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 450, padding: 35, borderRadius: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  alertTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  addAlertContent: { backgroundColor: '#FFF', width: 450, padding: 30, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  addAlertTitle: { fontSize: 22, fontWeight: 'bold', color: '#2C3E50', marginBottom: 25, textAlign: 'center', letterSpacing: 1 },
  modalInputBlock: { width: '100%', marginBottom: 16 },
  modalInputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  modalInputField: { width: '100%', fontSize: 16, color: '#333', backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  messageContainer: { alignItems: 'center', width: '100%', marginBottom: 30 },
  alertMessage: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 6 },
  productHighlight: { fontSize: 18, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 12 },
  alertSubMessage: { fontSize: 14, color: '#7F8C8D', textAlign: 'center', lineHeight: 22 },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  modalBtn: { width: 160, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
  modalBtnCancel: { backgroundColor: '#F0F0F0' },
  modalBtnCancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  modalBtnRejectConfirm: { backgroundColor: '#FF4D4D' },
  modalBtnApproveConfirm: { backgroundColor: '#00C853' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});