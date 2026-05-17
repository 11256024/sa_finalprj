import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 1. 全頁面配置物件
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
  
  // 警示框文字
  deleteAlertTitle: '是否刪除商品？',
  cancelAddAlertTitle: '是否要取消商品？',
  alertWarningTitle: '提示',
  alertMissingFields: '請填寫完整的商品名稱、單位與熱量！',
  alertInvalidCalorie: '熱量請輸入正確的數字！',
  
  // 審核機制提示文字
  alertSubmitSuccessTitle: '商品已送出審核',
  alertSubmitSuccessMessage: '管理員審核通過後將會正式入庫供大眾搜尋。在此之前，您可以直接使用它來計算您的每日熱量！',
  
  // 狀態標籤文字
  statusPending: ' （個人審核中，可用於計算）', // 💡 前方留一個空格

  // 警示對話框按鈕
  btnCancel: '取消',
  btnConfirm: '確定',
  btnNo: '否',
  btnYes: '是',

  // 正方形新增商品介面文字
  modalTitle: '新 增 商 品',
  labelName: '商 品 名 稱',
  labelUnit: '單 位',
  labelCalorie: '熱 量（ 大 卡 ）',
  modalConfirm: '確 認',
  modalCancel: '取 消',
};

// 2. 初始商品數據
const initialProducts = [
  { id: '1', name: '光泉 無糖豆漿 / 一瓶', calories: 120, status: 'approved' },
  { id: '2', name: '統一 低脂鮮乳 / 一盒', calories: 150, status: 'approved' },
  { id: '3', name: '茶葉蛋 / 一顆', calories: 75, status: 'approved' },
];

export default function ProductsScreen() {
  const router = useRouter();
  const txt = pageLanguageConfig;

  // 狀態管理
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState(initialProducts); 
  
  // 新增自訂商品彈窗控制
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('');
  const [newProductCalorie, setNewProductCalorie] = useState('');

  // 全域通用自訂警示框狀態
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

  const showCustomAlert = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    cancelText = txt.btnCancel, 
    confirmText = txt.btnConfirm
  ) => {
    setCustomAlert({ visible: true, title, message, onConfirm, cancelText, confirmText });
  };
  
  // 💡 導覽列路由
  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') {
      router.push('/profile');
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');
    } else if (menuName === '歷史紀錄') {
      router.push('/history');
    } else if (menuName === '身體指數查詢') {
      router.push('/body-metrics');
    } else if (menuName === '查詢商品') {
      router.push('/products');
    } else if (menuName === '成就管理') {
      router.push('/achievements');
    }
  };

  // 開啟新增彈窗
  const openAddModal = () => {
    setNewProductName('');
    setNewProductUnit('');
    setNewProductCalorie('');
    setIsModalVisible(true);
  };

  // 雙重取消處理
  const handleCancelAdd = () => {
    showCustomAlert(
      txt.cancelAddAlertTitle, 
      '',
      () => {
        setIsModalVisible(false);
        setNewProductName('');
        setNewProductUnit('');
        setNewProductCalorie('');
      },
      txt.btnNo,
      txt.btnYes
    );
  };

  // 確認送出商品
  const handleConfirmAdd = () => {
    if (!newProductName.trim() || !newProductUnit.trim() || !newProductCalorie.trim()) {
      showCustomAlert(txt.alertWarningTitle, txt.alertMissingFields, () => {}, '', txt.btnConfirm);
      return;
    }

    const calorieNum = parseInt(newProductCalorie, 10);
    if (isNaN(calorieNum)) {
      showCustomAlert(txt.alertWarningTitle, txt.alertInvalidCalorie, () => {}, '', txt.btnConfirm);
      return;
    }

    const combinedName = `${newProductName.trim()} / ${newProductUnit.trim()}`;

    const pendingProductItem = {
      id: `pending_${Date.now()}`, 
      name: combinedName,
      calories: calorieNum,
      status: 'pending' 
    };

    setProducts([pendingProductItem, ...products]);
    setIsModalVisible(false);

    setTimeout(() => {
      showCustomAlert(
        txt.alertSubmitSuccessTitle,
        txt.alertSubmitSuccessMessage,
        () => {},
        '', 
        txt.btnConfirm
      );
    }, 400);
  };

  // 刪除商品動作
  const handleDeleteProduct = (id: string, name: string) => {
    showCustomAlert(
      txt.deleteAlertTitle,
      `商品：${name}`,
      () => {
        setProducts(prevList => prevList.filter(item => item.id !== id));
      }
    );
  };

  const handleCancelSearch = () => {
    setSearchQuery('');
  };

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

      {/* 2. 主內容卡片 */}
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>
          
          <View style={styles.cardHeader}>
            <Text style={styles.pageTitle}>{txt.pageTitle}</Text>
            <TouchableOpacity onPress={openAddModal}>
              <Text style={styles.addText}>{txt.addButtonText}</Text>
            </TouchableOpacity>
          </View>

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

          {/* 3. 商品清單 */}
          <View style={styles.listContainer}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.scrollListContent}>
              {filteredProducts.map((item) => (
                <View key={item.id} style={styles.productRow}>
                  
                  {/* 💡 修正：將商品名稱與審核狀態寫在同一個 Text 標籤內，並強制單行，絕不換行 */}
                  <View style={styles.nameAndStatusWrapper}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                      {item.status === 'pending' && (
                        <Text style={styles.pendingStatusTag}>{txt.statusPending}</Text>
                      )}
                    </Text>
                  </View>
                  
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
         📦 視窗 A：正方形新增商品彈窗
         ========================================================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={handleCancelAdd}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={handleCancelAdd}
        >
          <TouchableOpacity activeOpacity={1} style={styles.squareModalContent}>
            
            <Text style={styles.orangeModalTitle}>{txt.modalTitle}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelName}</Text>
              <TextInput
                style={styles.underlineInput}
                value={newProductName}
                onChangeText={setNewProductName}
                autoFocus={true}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelUnit}</Text>
              <TextInput
                style={styles.underlineInput}
                value={newProductUnit}
                onChangeText={setNewProductUnit}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{txt.labelCalorie}</Text>
              <TextInput
                style={styles.underlineInput}
                keyboardType="numeric"
                value={newProductCalorie}
                onChangeText={setNewProductCalorie}
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

      {/* ==========================================================
         💡 視窗 B：通用自訂提示與警示對話框
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
              {customAlert.cancelText ? (
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalBtnCancel]} 
                  onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.modalBtnCancelText}>{customAlert.cancelText}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={[styles.modalBtn, styles.orangeAlertBtn]} 
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

  /* 主介面佈局 */
  mainContent: { flex: 1, paddingHorizontal: 80, paddingTop: 30, paddingBottom: 20 },
  cardContainer: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 30, paddingHorizontal: 40, paddingTop: 35, paddingBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', letterSpacing: 2 },
  addText: { fontSize: 16, color: '#4A90E2', fontWeight: 'bold' },

  /* 搜尋欄 */
  searchRowContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, width: '100%' },
  searchBoxWrapper: { flex: 1, backgroundColor: '#EBEBEB', borderRadius: 25, paddingHorizontal: 20, height: 46, justifyContent: 'center' },
  searchInput: { fontSize: 15, color: '#333' },
  searchCancelButton: { paddingLeft: 15, paddingVertical: 10, justifyContent: 'center' },
  searchCancelText: { fontSize: 16, color: '#666', fontWeight: '500' },
  recentText: { fontSize: 14, color: '#A0A0A0', marginBottom: 15, paddingLeft: 5, letterSpacing: 1 },

  /* 列表排版與審核狀態樣式 */
  listContainer: { flex: 1, width: '100%' },
  scrollListContent: { paddingBottom: 10 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 20, paddingHorizontal: 5 },
  nameAndStatusWrapper: { flex: 2, justifyContent: 'center' },
  productName: { fontSize: 16, color: '#333', fontWeight: '500' },
  pendingStatusTag: { fontSize: 14, color: '#E67E22', fontWeight: '500' }, // 調整字體大小，使其在同一直線上更和諧
  productCalorie: { flex: 1.5, fontSize: 15, color: '#888', textAlign: 'center' },
  deleteText: { flex: 0.5, fontSize: 15, color: '#4A90E2', fontWeight: 'bold', textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15 },

  /* 彈窗遮罩 */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  
  /* 正方形自訂商品彈窗 */
  squareModalContent: { 
    backgroundColor: '#FFDDBB', 
    width: 440,                  
    height: 440,                 
    paddingHorizontal: 40,
    justifyContent: 'center',    
    borderRadius: 24, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 12, 
    elevation: 8 
  },
  orangeModalTitle: { fontSize: 26, fontWeight: 'bold', color: '#000', letterSpacing: 3, textAlign: 'center', marginBottom: 25 },
  
  /* 輸入框樣式 */
  inputGroup: { marginBottom: 20, width: '100%' },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 5 },
  underlineInput: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#666', 
    fontSize: 15, 
    color: '#333', 
    paddingVertical: 4,
    paddingHorizontal: 2
  },

  /* 按鈕群組 */
  orangeRowButtonGroup: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 25,
    paddingHorizontal: 10
  },
  orangeCancelBtn: {
    backgroundColor: '#EAEAEA', 
    width: '45%', 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  orangeCancelBtnText: { color: '#555', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  orangeConfirmBtn: { 
    backgroundColor: '#FFAA77', 
    width: '45%', 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  orangeConfirmBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },

  /* 提示彈窗樣式 */
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