import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DataProvider } from '../context/DataContext';

// 🎯 統一 API 端口，解決部分頁面連不到後端的問題
const API_URL = 'http://127.0.0.1:8000';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [globalAvatar, setGlobalAvatar] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string>('👤'); // 預設安全符號改為人像

  // 🌟 新增：專門控制身分驗證載入狀態，防止刷新閃爍
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 控管目前是否為管理者狀態
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // 🌟 控制登出彈窗的顯示狀態與類型
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [logoutType, setLogoutType] = useState<'user' | 'admin'>('user');

  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // 檢查登入身份與載入資料
  const checkAuthAndLoadData = useCallback(async () => {
    // 1. 檢查是否為管理員登入
    if (Platform.OS === 'web') {
      const adminStatus = localStorage.getItem('admin_logged_in');
      setIsAdminLoggedIn(adminStatus === 'true');
    }

    try {
      // 2. 取得目前登入使用者 ID
      const savedUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';

      // 3. 撈取目前使用者自己的頭像與名字資料
      const savedUri =
        await AsyncStorage.getItem(`${savedUserId}_user_avatar_uri`) ||
        await AsyncStorage.getItem('user_avatar_uri');

      const savedAvatar =
        await AsyncStorage.getItem(`${savedUserId}_user_avatar`) ||
        await AsyncStorage.getItem('user_avatar');

      const savedProfileStr = await AsyncStorage.getItem(`${savedUserId}_user_profile`);
      const savedUserStr = await AsyncStorage.getItem('user');
      const savedNameKey = await AsyncStorage.getItem(`${savedUserId}_user_name_key`);

      let avatarFromProfile = null;
      let detectedName = '';

      // 最高優先權：會員中心儲存的姓名
      if (savedNameKey && savedNameKey.trim().length > 0) {
        detectedName = savedNameKey.trim();
      }

      // 第二順位：目前使用者自己的 profile
      if (!detectedName.trim() && savedProfileStr) {
        const profile = JSON.parse(savedProfileStr);
        avatarFromProfile = profile.avatarUrl || profile.avatar || profile.avatarUri || profile.image || profile.uri || null;
        detectedName = profile.name || profile.username || profile.nickname || profile.displayName || '';

        if (!detectedName.trim()) {
          for (const key in profile) {
            if (
              typeof profile[key] === 'string' &&
              profile[key].trim().length > 0 &&
              !['account', 'username', 'password', 'gender', 'birthday', 'height', 'weight', 'age'].includes(key.toLowerCase())
            ) {
              detectedName = profile[key];
              break;
            }
          }
        }
      }

      // 第三順位：登入時存入的 user 物件
      if (!detectedName.trim() && savedUserStr) {
        const user = JSON.parse(savedUserStr);
        avatarFromProfile = avatarFromProfile || user.avatarUrl || user.avatar || user.image || null;
        detectedName = user.name || user.username || user.nickname || user.displayName || '';
      }

      const cleanedName = detectedName.trim();
      let finalFirstChar = '👤';

      // 🟢 修正：移除名字內所有的標點符號、空白與特殊符號（只保留中文與英文），並拿第一個字
      if (cleanedName.length > 0) {
        const cleanText = cleanedName.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
        if (cleanText.length > 0) {
          const nameChars = Array.from(cleanText);
          finalFirstChar = nameChars[0]; // 🚀 改為抓取第一個有效文字
        }
      }

      const finalAvatarUri = savedUri || savedAvatar || avatarFromProfile;
      let safeAvatarUri = finalAvatarUri;

      if (safeAvatarUri && safeAvatarUri.startsWith('blob:')) {
        safeAvatarUri = null;
        await AsyncStorage.removeItem('user_avatar');
        await AsyncStorage.removeItem('user_avatar_uri');
        await AsyncStorage.removeItem(`${savedUserId}_user_avatar`);
        await AsyncStorage.removeItem(`${savedUserId}_user_avatar_uri`);
      } else if (safeAvatarUri && !safeAvatarUri.match(/^(data:image|https?:\/\/|file:\/\/)/)) {
        safeAvatarUri = null;
        await AsyncStorage.removeItem('user_avatar');
        await AsyncStorage.removeItem(`${savedUserId}_user_avatar`);
      }

      setGlobalAvatar(safeAvatarUri || null);
      setFallbackText(finalFirstChar);
    } catch (e) {
      console.log('全域 Layout 讀取失敗：', e);
      setGlobalAvatar(null);
      setFallbackText('👤');
    } finally {
      // 🌟 核心防禦：不論讀取成功或失敗，確認完畢後關閉載入狀態
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [pathname]); 

  // 判定是否為登入/註冊頁
  const isAuthPage = pathname === '/' || pathname === '/register';
  // 判定當前是否在會員中心頁面
  const isProfilePage = pathname === '/profile';
  
  // 判定目前是否為管理者頁面
  const isAdminPage = pathname === '/admin-review';

  // 🌟 核心防禦點：如果還在讀取 localStorage/身分狀態，完全不渲染任何橫幅與內頁，避免橫幅跳動
  if (isAuthLoading) {
    return null;
  }

  // 核心清除 Session 的登出執行動作
  const executeLogoutLogic = async () => {
    try {
      await AsyncStorage.multiRemove([
        'user',
        'member_id',
        'current_user_id',
        'account',
        'password',
        'user_avatar',
        'user_avatar_uri',
        'guest_user_avatar',
        'guest_user_avatar_uri',
        'userProfile',
        'user_profile',
        'user_name_key',
        'user_height_key',
        'height',
        'user_weight_key',
        'weight',
        'age',
      ]);

      if (Platform.OS === 'web') {
        localStorage.removeItem('admin_logged_in');
      }

      setGlobalAvatar(null);
      setFallbackText('👤');
      setIsAdminLoggedIn(false);

      router.replace('/');
    } catch (e) {
      console.log('登出失敗：', e);
    }
  };

  // 🌟 修改：使用者點擊右上角登出時，觸發客製化彈窗
  const handleUserLogout = () => {
    setLogoutType('user');
    setLogoutModalVisible(true);
  };

  // 🌟 修改：管理者點擊右上角登出時，觸發客製化彈窗
  const handleAdminLogout = () => {
    setLogoutType('admin');
    setLogoutModalVisible(true);
  };

  // 🌟 按下彈窗中的「確定」後，關閉彈窗並執行登出
  const handleConfirmLogout = () => {
    setLogoutModalVisible(false);
    executeLogoutLogic();
  };

  return (
    <DataProvider>
      <SafeAreaView style={styles.container}>
      
      {/* 身份決定顯示「藍色」或「綠色」橫幅 */}
      {isAdminLoggedIn && isAdminPage ? (
        /* 🔵 ================= 管理者橫幅 (藍色) ================= */
        <View style={[styles.header, styles.adminHeader]}>
          <View style={styles.headerLeftGroup}>
            <Text style={styles.headerTitle}>食半功倍 ・ 管理者後台</Text>
          </View>
          <TouchableOpacity style={styles.adminLogoutBtn} onPress={handleAdminLogout}>
            <Text style={styles.adminLogoutBtnText}>登出系統</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* 🟢 ================= 使用者橫幅 (綠色) ================= */
        <View style={[styles.header, styles.userHeader]}>
          {/* 左側：標題與功能選單 */}
          <View style={styles.headerLeftGroup}>
            
            <TouchableOpacity 
              onPress={() => {
                if (isAuthPage) {
                  router.replace('/'); // 踢回登入首頁 (index)
                } else {
                  router.push('/daily-record'); // 已登入一般使用者前往主頁
                }
              }} 
              activeOpacity={0.7}
            >
              <Text style={styles.headerTitle}>食半功倍</Text>
            </TouchableOpacity>
            
            {/* 只有「非登入/註冊頁面」才顯示選單按鈕 */}
            {!isAuthPage && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
                {menuItems.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <TouchableOpacity key={item.name} onPress={() => router.push(item.path as any)} style={styles.menuButton}>
                      <Text style={[styles.headerMenu, isActive && styles.activeMenu]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* 右側：會員狀態區 */}
          <View>
            {/* 只有「非登入/註冊頁面」才顯示右側頭像或登出按鈕 */}
            {!isAuthPage && (
              <>
                {isProfilePage ? (
                  <View style={styles.profileHeaderButtons}>
                    <View style={styles.activeProfileButton}>
                      <Text style={styles.activeProfileButtonText}>會員中心</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleUserLogout} activeOpacity={0.8}>
                      <Text style={styles.logoutButtonText}>登出</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/profile')}>
                    {globalAvatar ? (
                      <Image source={{ uri: globalAvatar }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.defaultAvatar}>
                        <Text style={styles.defaultAvatarText}>{fallbackText}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}

      {/* 內頁插入點 */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      {/* 🌟 萬能客製化「確認登出」警示框（使用者與管理員共用，文字動態切換） */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <Text style={styles.logoutModalTitle}>確認登出</Text>
            <Text style={styles.logoutModalMessage}>
              {logoutType === 'admin' 
                ? '確定要登出管理員系統，返回首頁嗎？' 
                : '確定要登出系統，返回首頁嗎？'}
            </Text>
            
            <View style={styles.logoutModalButtonGroup}>
              {/* 左邊：返回按鈕 (白底、純黑邊框、大圓角) */}
              <TouchableOpacity 
                style={styles.logoutBtnReturn} 
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutBtnReturnText}>返回</Text>
              </TouchableOpacity>
              
              {/* 右邊：確定按鈕 (滿版質感亮橘底、白字) */}
              <TouchableOpacity 
                style={styles.logoutBtnConfirm} 
                onPress={handleConfirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutBtnConfirmText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { 
    height: 100, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 40, 
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  userHeader: { backgroundColor: '#A3C1AD' },
  adminHeader: { backgroundColor: '#34495E' },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { 
    color: 'white', 
    fontSize: 32, 
    fontWeight: 'bold',
    marginRight: 30, 
    ...Platform.select({ web: { cursor: 'pointer', userSelect: 'none' } })
  },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15, paddingVertical: 10 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8, paddingBottom: 4 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  avatarButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#D3D3D3' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' }, 
  profileHeaderButtons: { flexDirection: 'row', alignItems: 'center' },
  activeProfileButton: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 12 },
  activeProfileButtonText: { color: '#A3C1AD', fontSize: 15, fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#E76F51', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  adminLogoutBtn: { backgroundColor: '#E74C3C', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  adminLogoutBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  // ==================== 🌟 登出 Modal 專屬的設計美感樣式 ====================
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // 質感半透明黑底遮罩
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContent: {
    backgroundColor: '#FFFFFF',
    width: 380,                  // 寬度適中，多端完美相容
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 24,            // 採用大圓角卡片設計
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoutModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 14,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  logoutModalButtonGroup: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  // 👈 左按鈕：白底、細緻純黑框、大圓角
  logoutBtnReturn: {
    flex: 1,
    height: 48,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  logoutBtnReturnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 👉 右按鈕：滿版質感亮橘底 (完美複製確認取消對話框色彩)
  logoutBtnConfirm: {
    flex: 1,
    height: 48,
    backgroundColor: '#E58323', 
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});