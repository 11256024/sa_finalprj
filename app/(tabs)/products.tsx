import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 1. 全頁面配置物件（文字完全不寫死）
const pageLanguageConfig = {
  appName: '食半功倍',
  memberCenter: '會員中心',
  pageTitle: '新 增 / 刪 除 商 品',
  addButtonText: '+ 新 增',
  searchPlaceholder: '🔍  輸 入 商 品 名 稱',
  searchCancel: '取 消',
  recentSearchLabel: '近 期 查 詢',
  calorieLabelPrefix: '熱量（',
  calorieLabelSuffix: ' 大卡）',
  deleteButtonText: '- 刪 除',
  emptyResultText: '找不到相關商品',
  menuItems: ['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'],
  
  // 💡 警示框文字
  deleteAlertTitle: '是否刪除商品？',
  cancelAddAlertTitle: '是否要取消商品？',
  alertWarningTitle: '提示',
  alertMissingFields: '請填寫完整的商品名稱與熱量！',
  alertInvalidCalorie: '熱量請輸入正確的數字！',
  
  // 警示框按鈕
  btnCancel: '取消',
  btnConfirm: '確定',
  btnNo: '否',
  btnYes: '是',

  // 新增自訂商品彈窗文字
  modalTitle: '新增自訂商品',
  modalNamePlaceholder: '請輸入商品名稱 (例如：茶葉蛋 / 一顆)',
  modalCaloriePlaceholder: '請輸入熱量 (大卡)',
  modalCancel: '取消',
  modalConfirm: '確認新增',
};

// 2. 初始商品數據
const initialProducts = [
  { id: '1', name: '光泉 無糖豆漿 / 一瓶', calories: 120 },
  { id: '2', name: '光泉 無糖豆漿 / 一瓶', calories: 120 },
  { id: '3', name: '光泉 無糖豆漿 / 一瓶', calories: 120 },
  { id: '4', name: '光泉 無糖豆漿 / 一瓶', calories: 120 },
  { id: '5', name: '統一 低脂鮮乳 / 一盒', calories: 150 },
  { id: '6', name: '茶葉蛋 / 一顆', calories: 75 },
];

export default function ProductsScreen() {
  const router = useRouter();
  const txt = pageLanguageConfig;

  // 狀態管理
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState(initialProducts); 
  
  // 「新增自訂商品彈窗」控制狀態
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  // 💡【全新防掉功能】：自訂全平台通用警示框 (Custom Alert Modal) 狀態
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

  // 快捷觸發通用警示框函式
  const showCustomAlert = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    cancelText = txt.btnCancel, 
    confirmText = txt.btnConfirm
  ) => {
    setCustomAlert({ visible: true, title, message, onConfirm, cancelText, confirmText });
  };

  // 頂部導覽列跳轉邏輯
  const handleMenuPress = (menuName: string) => {
    if (menuName === '首頁') router.push('/');
    else if (menuName === '每日紀錄') router.push('/daily-record'); 
    else if (menuName === '歷史紀錄') router.push('/history');
    else if (menuName === '身體指數查詢') router.push('/body-metrics'); 
    else if (menuName === '查詢商品') router.push('/products');
    else if (menuName === '成就管理') router.push('/achievements');
    else if (menuName === '會員中心') router.push('/profile');
  };

  // 🛠️ 動作：開啟新增自訂商品彈窗
  const openAddModal = () => {
    setNewProductName('');
    setNewProductCalorie('');
    setIsModalVisible(true);
  };

  // 🛠️ 動作：點擊彈窗內「取消」-> 觸發自訂警示框詢問 "是否要取消商品？"
  const handleCancelAdd = () => {
    showCustomAlert(
      txt.cancelAddAlertTitle,
      '',
      () => {
        // 使用者點選「是」才關閉新增彈窗
        setIsModalVisible(false);
        setNewProductName('');
        setNewProductCalorie('');
      },
      txt.btnNo,
      txt.btnYes
    );
  };

  // 🛠️ 動作：確認新增商品與防呆
  const handleConfirmAdd = () => {
    if (!newProductName.trim() || !newProductCalorie.trim()) {
      showCustomAlert(txt.alertWarningTitle, txt.alertMissingFields, () => {}, '', txt.btnConfirm);
      return;
    }

    const calorieNum = parseInt(newProductCalorie, 10);
    if (isNaN(calorieNum)) {
      showCustomAlert(txt.alertWarningTitle, txt.alertInvalidCalorie, () => {}, '', txt.btnConfirm);
      return;
    }

    const newProductItem = {
      id: Date.now().toString(),
      name: newProductName.trim(),
      calories: calorieNum
    };

    setProducts([newProductItem, ...products]);
    setIsModalVisible(false);
  };

  // 🛠️ 動作：點擊「- 刪除」-> 觸發自訂警示框詢問 "是否刪除商品？"
  const handleDeleteProduct = (id: string, name: string) => {
    showCustomAlert(
      txt.deleteAlertTitle,
      `商品：${name}`,
      () => {
        // 使用者確認後動態從陣列中抹除
        setProducts(prevList => prevList.filter(item => item.id !== id));
      }
    );
  };

  // 🛠️ 動作：清空搜尋欄
  const handleCancelSearch = () => {
    setSearchQuery('');
  };

  // 即時搜尋過濾
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. 上方導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity onPress={() => handleMenuPress('首頁')}>
            <Text style={styles.headerTitle}>{txt.appName}</Text>
          </TouchableOpacity>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {txt.menuItems.map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[
                  styles.headerMenu, 
                  item === '查詢商品' && { fontWeight: 'bold', textDecorationLine: 'underline' }
                ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.memberBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberBtnText}>{txt.memberCenter}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. 主內容卡片區 */}
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          {/* 卡片頂部 */}
          <View style={styles.cardHeader}>
            <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
            <TouchableOpacity onPress={openAddModal}>
              <Text style={styles.addText}>{txt.addButtonText}</Text>
            </TouchableOpacity>
          </View>

          {/* 搜尋列 */}
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

          {/* 3. 商品數據清單列表 */}
          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {filteredProducts.map((item) => (
                <View key={item.id} style={styles.productRow}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  
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

      {/* ==========================================================
         📦 視窗 A：新增自訂商品彈窗 (Modal)
         ========================================================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={handleCancelAdd}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{txt.modalTitle}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={txt.modalNamePlaceholder}
              placeholderTextColor="#BBB"
              value={newProductName}
              onChangeText={setNewProductName}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={txt.modalCaloriePlaceholder}
              placeholderTextColor="#BBB"
              keyboardType="numeric"
              value={newProductCalorie}
              onChangeText={setNewProductCalorie}
            />

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={handleCancelAdd}>
                <Text style={styles.modalBtnCancelText}>{txt.modalCancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleConfirmAdd}>
                <Text style={styles.modalBtnConfirmText}>{txt.modalConfirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================================
         💡 視窗 B：全網頁通用自訂警示對話框 (解決 Alert 在 Web 無反應的問題)
         ========================================================== */}
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
              {/* 如果有取消/否的文字，才渲染左側取消按鈕 */}
              {customAlert.cancelText ? (
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalBtnCancel]} 
                  onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.modalBtnCancelText}>{customAlert.cancelText}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnConfirm]} 
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F1E7' },
  
  /* 導覽列 */
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500' },
  memberBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  memberBtnText: { color: '#FFF', fontSize: 14, fontWeight: '500' },

  /* 主要內容卡片佈局 */
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 30, paddingBottom: 20 },
  cardContainer: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingTop: 35, paddingBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 2 },
  addText: { fontSize: 16, color: '#4A90E2', fontWeight: 'bold' },

  /* 搜尋列 */
  searchRowContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, width: '100%' },
  searchBoxWrapper: { flex: 1, backgroundColor: '#EBEBEB', borderRadius: 25, paddingHorizontal: 20, height: 46, justifyContent: 'center' },
  searchInput: { fontSize: 15, color: '#333' },
  searchCancelButton: { paddingLeft: 15, paddingVertical: 10, justifyContent: 'center' },
  searchCancelText: { fontSize: 16, color: '#666', fontWeight: '500' },
  recentText: { fontSize: 14, color: '#A0A0A0', marginBottom: 15, paddingLeft: 5, letterSpacing: 1 },

  /* 清單區 */
  listContainer: { flex: 1, width: '100%' },
  scrollListContent: { paddingBottom: 10 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 20, paddingHorizontal: 5 },
  productName: { flex: 2, fontSize: 16, color: '#333', fontWeight: '500' },
  productCalorie: { flex: 1.5, fontSize: 15, color: '#888', textAlign: 'center' },
  deleteText: { flex: 0.5, fontSize: 15, color: '#4A90E2', fontWeight: 'bold', textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15 },

  /* 彈窗樣式架構 */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: 450, padding: 30, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 15, height: 45, fontSize: 14, marginBottom: 15, color: '#333' },
  
  /* 💡 自訂警示框專用小卡片樣式 */
  alertContent: { backgroundColor: '#FFF', width: 360, padding: 25, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  alertTitle: { fontSize: 19, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },

  /* 按鈕群組 */
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 1, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  modalBtnConfirm: { backgroundColor: '#A3C1AD' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});