import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const API_URL = 'http://127.0.0.1:8000';
export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [globalAvatar, setGlobalAvatar] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string>('用'); // 預設安全字

  // 控管目前是否為管理者狀態
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

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
      // 2. 撈取使用者頭像與名字資料
      const savedUri = await AsyncStorage.getItem('user_avatar_uri');
      const savedAvatar = await AsyncStorage.getItem('user_avatar');
      const savedProfileStr = await AsyncStorage.getItem('user_profile');
      const savedUserStr = await AsyncStorage.getItem('user');
      const savedNameKey = await AsyncStorage.getItem('user_name_key');

      let avatarFromProfile = null;
      let detectedName = '';

      if (savedNameKey && savedNameKey.trim().length > 0) {
        detectedName = savedNameKey.trim();
      }
      
      if (!detectedName.trim() && savedProfileStr) {
        const profile = JSON.parse(savedProfileStr);
        avatarFromProfile = profile.avatarUrl || profile.avatar || profile.avatarUri || profile.image || profile.uri || null;
        detectedName = profile.name || profile.username || profile.nickname || profile.displayName || '';
        
        if (!detectedName.trim()) {
          for (const key in profile) {
            if (typeof profile[key] === 'string' && 
                profile[key].trim().length > 0 && 
                !['account', 'username', 'password', 'gender', 'birthday'].includes(key.toLowerCase())) {
              detectedName = profile[key];
              break; 
            }
          }
        }
      } 
      
      if (!detectedName.trim() && savedUserStr) {
        const user = JSON.parse(savedUserStr);
        avatarFromProfile = avatarFromProfile || user.avatarUrl || user.avatar || user.image || null;
        detectedName = user.name || user.username || user.nickname || user.displayName || '';
      }

      const cleanedName = detectedName.trim();
      let finalLastChar = '用';
      if (cleanedName.length > 0) {
        finalLastChar = cleanedName.charAt(cleanedName.length - 1); 
      }

      const finalAvatarUri = savedUri || savedAvatar || avatarFromProfile;
      let safeAvatarUri = finalAvatarUri;
      if (safeAvatarUri && safeAvatarUri.startsWith('blob:')) {
        safeAvatarUri = null;
        await AsyncStorage.removeItem('user_avatar');
        await AsyncStorage.removeItem('user_avatar_uri');
      }
      else if (safeAvatarUri && !safeAvatarUri.match(/^(data:image|https?:\/\/|file:\/\/)/)) {
        safeAvatarUri = null;
        await AsyncStorage.removeItem('user_avatar');
      }
      
      setGlobalAvatar(safeAvatarUri || null);
      setFallbackText(finalLastChar);

    } catch (e) {
      console.log('全域 Layout 讀取失敗：', e);
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

  // 使用者登出
  const handleUserLogout = async () => {
  try {
    await AsyncStorage.multiRemove([
      'user',
      'member_id',
      'current_user_id',
      'account',
      'password',

      'user_avatar',
      'user_avatar_uri',

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
    setFallbackText('用');
    setIsAdminLoggedIn(false);

    router.replace('/');
  } catch (e) {
    console.log('使用者登出失敗：', e);
  }
};

  // 管理者登出
  const handleAdminLogout = () => {
  if (Platform.OS === 'web') {
    const confirmLogout = window.confirm("確定要登出管理員系統，返回首頁嗎？");
    if (confirmLogout) {
      handleUserLogout();
    }
  } else {
    handleUserLogout();
  }
};

  return (
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
            
            {/* 🎯 核心修改點：在註冊頁（或任何未登入狀態）點擊「食半功倍」標題，一律回登入頁面 */}
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
    </SafeAreaView>
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
  adminLogoutBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' }
});