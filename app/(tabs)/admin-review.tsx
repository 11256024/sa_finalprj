import { useRouter } from 'expo-router'; // 👈 1. 引入 router 用於頁面跳轉
import React, { useEffect, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending';
}

export default function AdminReviewScreen() {
  const router = useRouter(); // 👈 2. 初始化 router 控制器
  
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; action: 'approve' | 'reject' } | null>(null);

  // 載入時從 localStorage 動態撈取使用者提交的自訂商品
  useEffect(() => {
    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        const allProducts: Product[] = JSON.parse(storedProducts);
        setPendingProducts(allProducts.filter(p => p.status === 'pending'));
      } else {
        // 預設一筆測試資料，以防一開始沒資料
        const defaultData: Product[] = [
          { id: 'mock_1', name: '媽媽手作高麗菜水餃', unit: '一顆', calories: 45, status: 'pending' }
        ];
        localStorage.setItem('global_products', JSON.stringify(defaultData));
        setPendingProducts(defaultData);
      }
    }
  }, []);

  // 🎯 3. 處理登出邏輯：回到 index 登入頁
  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm("確定要登出管理員系統，返回首頁嗎？");
      if (confirmLogout) {
        // 這裡可以選擇性清除管理員的登入 Session 紀錄 (若原本有存的話)
        // localStorage.removeItem('isLoggedIn'); 
        
        // 🎯 順利跳轉回根目錄 index 登入頁面
        router.replace('/'); 
      }
    } else {
      router.replace('/');
    }
  };

  const triggerConfirm = (id: string, name: string, action: 'approve' | 'reject') => {
    setSelectedItem({ id, name, action });
    setConfirmModalVisible(true);
  };

  const handleExecuteAction = () => {
    if (!selectedItem) return;
    const { id, name, action } = selectedItem;

    if (Platform.OS === 'web') {
      const storedProducts = localStorage.getItem('global_products');
      if (storedProducts) {
        let allProducts: Product[] = JSON.parse(storedProducts);

        if (action === 'reject') {
          // 拒絕退件：永久移除資料
          allProducts = allProducts.filter(p => p.id !== id);
        } else {
          // 核准入庫：更新為 approved，讓使用者查得到
          allProducts = allProducts.map(p => p.id === id ? { ...p, status: 'approved' } : p);
        }

        localStorage.setItem('global_products', JSON.stringify(allProducts));
        setPendingProducts(allProducts.filter(p => p.status === 'pending'));
      }
    }

    setConfirmModalVisible(false);
    setSelectedItem(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 管理者頂部導覽列 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>食半功倍 ・ 管理者後台</Text>
        
        {/* 🎯 綁定登出點擊事件 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>登出系統</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainCard}>
          <Text style={styles.pageTitle}>待 審 核 商 品 清 單</Text>
          <View style={styles.titleDivider} />
          
          {pendingProducts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>🎉 目前沒有任何待審核的自訂商品唷！</Text>
            </View>
          ) : (
            pendingProducts.map((item) => (
              <View key={item.id} style={styles.reviewRow}>
                {/* 左側：商品資訊 */}
                <View style={styles.infoGroup}>
                  <Text style={styles.prodName}>{item.name} / {item.unit}</Text>
                  <Text style={styles.prodCal}>熱量：{item.calories} 大卡</Text>
                  <Text style={styles.contributorText}>貢獻者 ID: user_07</Text>
                </View>

                {/* 右側：審核按鈕 */}
                <View style={styles.btnGroup}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.rejectBtn]} 
                    onPress={() => triggerConfirm(item.id, item.name, 'reject')}
                  >
                    <Text style={styles.rejectBtnText}>拒絕退件</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.approveBtn]} 
                    onPress={() => triggerConfirm(item.id, item.name, 'approve')}
                  >
                    <Text style={styles.approveBtnText}>核准入庫</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 🎯 完美還原：審核防呆彈窗 (Modal) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            
            {/* 標題與⚠️圖示 */}
            <Text style={styles.alertTitle}>
              {selectedItem?.action === 'reject' ? '⚠️ 確認要拒絕退件嗎？' : '💡 確認要核准入庫嗎？'}
            </Text>

            {/* 訊息內容：完全修正文字殘留 \n 的問題 */}
            <View style={styles.messageContainer}>
              <Text style={styles.alertMessage}>
                您即將{selectedItem?.action === 'reject' ? '「拒絕並刪除」' : '「核准並上架」'}商品：
              </Text>
              <Text style={styles.productHighlight}>
                「{selectedItem?.name}」
              </Text>
              <Text style={styles.alertSubMessage}>
                {selectedItem?.action === 'reject' 
                  ? '退件後，該商品資料將會從審核隊列中永久移除。' 
                  : '通過後，該商品將正式進入官方資料庫，所有使用者皆可查詢。'}
              </Text>
            </View>
            
            {/* 左右對稱的按鈕組 */}
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modalBtn, 
                  selectedItem?.action === 'reject' ? styles.modalBtnRejectConfirm : styles.modalBtnApproveConfirm
                ]} 
                onPress={handleExecuteAction}
              >
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
  header: { height: 70, backgroundColor: '#34495E', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#E74C3C', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  logoutBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  scrollContent: { paddingVertical: 40, alignItems: 'center' },
  mainCard: { backgroundColor: 'white', width: '90%', minHeight: 600, borderRadius: 16, padding: 40, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#2C3E50', letterSpacing: 2 },
  titleDivider: { height: 1, backgroundColor: '#E0E0E0', marginTop: 15, marginBottom: 30 },

  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#95A5A6' },

  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  infoGroup: { flex: 1 },
  prodName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  prodCal: { fontSize: 14, color: '#666', marginBottom: 4 },
  contributorText: { fontSize: 12, color: '#BDC3C7' },

  btnGroup: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginLeft: 12 },
  rejectBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E74C3C' },
  rejectBtnText: { color: '#E74C3C', fontSize: 14, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#00C853' },
  approveBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  // 🎯 圓角防呆彈窗樣式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 450, padding: 35, borderRadius: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  alertTitle: { fontSize: 24, fontWeight: 'bold', color: '#E74C3C', marginBottom: 20, textAlign: 'center' },
  
  messageContainer: { alignItems: 'center', width: '100%', marginBottom: 30 },
  alertMessage: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 6 },
  productHighlight: { fontSize: 18, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 12 },
  alertSubMessage: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'center', width: '100%' },
  modalBtn: { width: 160, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginHorizontal: 10 },
  modalBtnCancel: { backgroundColor: '#F0F0F0' },
  modalBtnCancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  
  modalBtnRejectConfirm: { backgroundColor: '#FF4D4D' },
  modalBtnApproveConfirm: { backgroundColor: '#00C853' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});