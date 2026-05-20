import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [globalAvatar, setGlobalAvatar] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string>('用'); // 預設安全字

  const menuItems = [
    { name: '每日紀錄', path: '/daily-record' },
    { name: '歷史紀錄', path: '/history' },
    { name: '身體指數查詢', path: '/body-metrics' },
    { name: '查詢商品', path: '/products' },
    { name: '成就管理', path: '/achievements' },
  ];

  // 🟢 用 useCallback 確保函數引用不變
  const loadUserAvatarAndData = useCallback(async () => {
    try {
      // 1. 多重管道撈取頭像圖片 URI
      const savedUri = await AsyncStorage.getItem('user_avatar_uri');
      const savedAvatar = await AsyncStorage.getItem('user_avatar');
      
      console.log('🔴 存儲檢查 - savedUri:', savedUri);
      console.log('🔴 存儲檢查 - savedAvatar:', savedAvatar);
      
      // 2. 同步讀取整包個人檔案或使用者資訊物件
      const savedProfileStr = await AsyncStorage.getItem('user_profile');
      const savedUserStr = await AsyncStorage.getItem('user');
      // 🟢 新增：直接讀取獨立儲存的名字 key
      const savedNameKey = await AsyncStorage.getItem('user_name_key');

      console.log('🔍 Debug 撈取:', { savedNameKey, savedProfileStr: savedProfileStr ? '存在' : '不存在' });

      let avatarFromProfile = null;
      let detectedName = '';

      // 🟢 最高優先級：直接讀取獨立儲存的名字 key（profile 頁面保存時的標準位置）
      if (savedNameKey && savedNameKey.trim().length > 0) {
        detectedName = savedNameKey.trim();
        console.log('✅ 從 user_name_key 讀到名字:', detectedName);
      }
      
      // 3. 🎯 終極解析邏輯：全面防禦，確保一定能抓到「王小明」
      if (!detectedName.trim() && savedProfileStr) {
        const profile = JSON.parse(savedProfileStr);
        avatarFromProfile = profile.avatarUrl || profile.avatar || profile.avatarUri || profile.image || profile.uri || null;
        
        // 🟢 1. 優先嘗試所有可能的標準名字欄位 key 
        detectedName = profile.name || profile.username || profile.nickname || profile.displayName || '';
        console.log('✅ 從 user_profile 讀到名字:', detectedName);
        
        // 🟢 2. 【大絕招防禦】如果還是空的，掃描物件內所有屬性，只要是字串且不是密碼/帳號，就當作潛在名字
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
      
      // 如果都沒撈到，試試看 user 物件
      if (!detectedName.trim() && savedUserStr) {
        const user = JSON.parse(savedUserStr);
        avatarFromProfile = avatarFromProfile || user.avatarUrl || user.avatar || user.image || null;
        detectedName = user.name || user.username || user.nickname || user.displayName || '';
        console.log('✅ 從 user 讀到名字:', detectedName);
      }

      // 4. 🟢 去除空白並精準提取最後一個字
      const cleanedName = detectedName.trim();
      let finalLastChar = '用'; // 最終後備

      if (cleanedName.length > 0) {
        finalLastChar = cleanedName.charAt(cleanedName.length - 1); 
      }

      console.log('🎯 最終結果 - 名字:', cleanedName, '最後一字:', finalLastChar);

      // 優先將所有管道撈出來的圖片網址融合，圖片絕對優先
      const finalAvatarUri = savedUri || savedAvatar || avatarFromProfile;
      
      console.log('🖼️ 頭像 URI (前50字):', finalAvatarUri ? finalAvatarUri.substring(0, 50) : 'null');
      
      // 🔴 新增防呆：檢查 blob: URL（無效）或無有效格式的 URI，清除它們
      let safeAvatarUri = finalAvatarUri;
      if (safeAvatarUri && safeAvatarUri.startsWith('blob:')) {
        console.log('⚠️ 檢測到無效的 blob URL，清除');
        safeAvatarUri = null;
        // 同時清除存儲
        await AsyncStorage.removeItem('user_avatar');
        await AsyncStorage.removeItem('user_avatar_uri');
      }
      // 🟢 有效的格式：data:image（Base64）或 http/https 或 file://
      else if (safeAvatarUri && !safeAvatarUri.match(/^(data:image|https?:\/\/|file:\/\/)/)) {
        console.log('⚠️ 檢測到無效的 URI 格式，清除:', safeAvatarUri.substring(0, 50));
        safeAvatarUri = null;
        await AsyncStorage.removeItem('user_avatar');
      }
      
      console.log('💾 設置 state - avatar:', safeAvatarUri ? '有效' : 'null', 'fallbackText:', finalLastChar);
      
      setGlobalAvatar(safeAvatarUri || null);
      setFallbackText(finalLastChar);

    } catch (e) {
      console.log('全域 Layout 撈取大頭貼/名字失敗：', e);
    }
  }, []);

  useEffect(() => {
    loadUserAvatarAndData();
  }, []); // 🎯 組件掛載時執行一次

  useEffect(() => {
    loadUserAvatarAndData();
  }, [pathname]); // 🎯 路由改變時重新讀取

  // 判定是否為登入/註冊頁
  const isAuthPage = pathname === '/' || pathname === '/register';
  // 🎯 判定當前是否在會員中心頁面
  const isProfilePage = pathname === '/profile';

  // 處理點擊登出
  const handleLogout = async () => {
    try {
      // 清除登入狀態快取（可根據需要增加要清除的欄位）
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('account');
      // 🔴 新增：登出時也清除無效的頭像
      await AsyncStorage.removeItem('user_avatar');
      await AsyncStorage.removeItem('user_avatar_uri');
      // 切換回登入頁面
      router.replace('/');
    } catch (e) {
      console.log('登出失敗：', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 全站統一、唯一的頂部動態導覽列 */}
      <View style={styles.header}>
        
        {/* 左側：標題與功能選單 */}
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity 
            onPress={() => {
              if (isAuthPage) {
                router.replace('/');
              } else {
                router.push('/daily-record');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.headerTitle}>食半功倍</Text>
          </TouchableOpacity>
          
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
        {!isAuthPage && (
          <View>
            {isProfilePage ? (
              // 🎯 1. 如果在 Profile 頁面：橫幅維持原本定義的【會員中心】標籤與【登出】按鈕
              <View style={styles.profileHeaderButtons}>
                <View style={styles.activeProfileButton}>
                  <Text style={styles.activeProfileButtonText}>會員中心</Text>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                  <Text style={styles.logoutButtonText}>登出</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // 🎯 2. 如果在其他非 Profile 內頁：維持原本圓形大頭貼，點擊切換至 Profile
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
          </View>
        )}
      </View>

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
    backgroundColor: '#A3C1AD', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 30, 
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { 
    color: 'white', 
    fontSize: 32, 
    fontWeight: 'bold',
    marginRight: 30, 
    ...Platform.select({ web: { cursor: 'pointer', userSelect: 'none' } })
  },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { 
    paddingHorizontal: 15, 
    paddingVertical: 10 
  },
  headerMenu: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: '500', 
    opacity: 0.8, 
    paddingBottom: 4 
  },
  activeMenu: { 
    opacity: 1, 
    fontWeight: 'bold', 
    borderBottomWidth: 2, 
    borderBottomColor: 'white' 
  },
  avatarButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    overflow: 'hidden', 
    backgroundColor: '#D3D3D3', 
    elevation: 2, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  defaultAvatar: { width: '100%', height: '100%', backgroundColor: '#D3D3D3', justifyContent: 'center', alignItems: 'center' },
  defaultAvatarText: { color: '#555', fontSize: 18, fontWeight: 'bold' }, 
  profileHeaderButtons: { flexDirection: 'row', alignItems: 'center' },
  activeProfileButton: { backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 12 },
  activeProfileButtonText: { color: '#A3C1AD', fontSize: 15, fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#E76F51', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
});