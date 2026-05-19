import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter(); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);
  
  // 保持全域登入狀態（預設未登入 false）
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 自訂防呆登出彈窗的顯示狀態
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // 登入驗證與跳轉邏輯
  const handleLogin = () => {
    // 1. 密碼強度正規表達式驗證
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[.!?@]).{8,}$/;
    
    if (!passwordRegex.test(password)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    
    // 2. 帳密與身分分流驗證
    if (username.trim() === 'admin' && password === 'Admin123!') {
      setIsLoggedIn(true);
      if (Platform.OS === 'web') {
        window.alert("歡迎回來，尊貴的系統管理員！");
        router.replace('/admin-review'); // 使用 replace 徹底取代頁面
      } else {
        Alert.alert("登入成功", "歡迎回來，尊貴的系統管理員！", [
          { text: "進入後台", onPress: () => router.replace('/admin-review') }
        ]);
      }
    } else {
      // 一般使用者登入
      setIsLoggedIn(true);
      if (Platform.OS === 'web') {
        window.alert("普通使用者登入成功！");
        router.replace('/profile'); // 改為 replace，防止背景登入狀態卡死
      } else {
        Alert.alert("登入成功", "普通使用者登入成功！", [
          { text: "確定", onPress: () => router.replace('/profile') }
        ]);
      }
    }
  };

  // 觸發登出防呆
  const handleLogoutTrigger = () => {
    setLogoutModalVisible(true);
  };

  // 確認登出動作
  const handleConfirmLogout = () => {
    setIsLoggedIn(false);         
    setUsername('');              
    setPassword('');
    setLogoutModalVisible(false); 
    if (Platform.OS === 'web') {
      window.alert("您已成功登出系統。");
    } else {
      Alert.alert("提示", "您已成功登出系統。");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 頂部導覽列 - 純淨保留「食半功倍」 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
        </View>

        {/* 右側動態按鈕：若為登入狀態，顯示防呆登出按鈕 */}
        {isLoggedIn && (
          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogoutTrigger}>
            <Text style={styles.logoutHeaderBtnText}>登 出</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.pageTitle}>登 入</Text>
        
        <View style={styles.cardContainer}>
          <View style={styles.inputContainer}>
            {/* 帳號 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>帳 號</Text>
              <TextInput 
                style={styles.input} 
                placeholder="請輸入帳號"
                placeholderTextColor="#A9A9A9"
                value={username}
                onChangeText={(text) => { setUsername(text); setShowError(false); }}
                autoCapitalize="none"
              />
            </View>

            {/* 密碼 */}
            <View style={[styles.inputGroup, { marginBottom: 10 }]}>
              <Text style={styles.label}>密 碼</Text>
              <TextInput 
                style={styles.input} 
                placeholder="請輸入密碼"
                placeholderTextColor="#A9A9A9"
                secureTextEntry={true}
                value={password}
                onChangeText={(text) => { setPassword(text); setShowError(false); }}
              />
            </View>

            {/* 警示區 */}
            <View style={styles.hintArea}>
              {showError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    ⚠️ 需包含至少一個大寫英文字母；一個小寫英文字母；一個數字；一個特殊字元，如：.!?@；且長度至少 8 字元 !
                  </Text>
                </View>
              ) : (
                <Text style={styles.hintText}>
                  * 需包含至少一個大寫英文字母；一個小寫英文字母；一個數字；一個特殊字元，如：.!?@；且長度至少 8 字元 !
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={handleLogin}>
            <Text style={styles.confirmButtonText}>確 認</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.registerLink}>註 冊</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 登出防呆彈窗 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPressOut={() => setLogoutModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.logoutAlertContent}>
            <Text style={styles.logoutAlertTitle}>確認要登出系統嗎？</Text>
            <Text style={styles.logoutAlertMessage}>登出後將需要重新輸入帳號與密碼才能進行熱量管理。</Text>
            
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.orangeAlertBtn]} 
                onPress={handleConfirmLogout}
              >
                <Text style={styles.modalBtnConfirmText}>確定登出</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  
  logoutHeaderBtn: { 
    backgroundColor: 'rgba(231, 76, 60, 0.8)', 
    paddingVertical: 8, 
    paddingHorizontal: 18, 
    borderRadius: 20 
  },
  logoutHeaderBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC' },
  pageTitle: { fontSize: 36, marginBottom: 30, color: '#333', fontWeight: 'bold' },
  
  cardContainer: {
    backgroundColor: 'white',
    width: '45%', 
    minWidth: 420, 
    padding: 40,
    borderRadius: 30, 
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    elevation: 5,
  },
  
  inputContainer: { width: '100%' },
  inputGroup: { 
    marginBottom: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ccc',
    width: '100%',
  },
  label: { fontSize: 20, color: '#333', fontWeight: '600', marginBottom: 5 },
  // 🎯 修正處：將 Web 專屬的點選外框樣式（outlineStyle）正確寫在 style 裡面
  input: { 
    fontSize: 16, 
    color: '#333', 
    paddingVertical: 10,
    ...Platform.select({ web: { outlineStyle: 'none' as any } })
  },
  
  hintArea: { minHeight: 60, marginBottom: 15 },
  errorBox: {
    backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FF4D4F',
    borderRadius: 8, padding: 10,
  },
  errorText: { color: '#FF4D4F', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hintText: { fontSize: 13, color: '#888', lineHeight: 18, paddingHorizontal: 5 },

  confirmButton: { 
    backgroundColor: '#F3B07E', 
    paddingVertical: 14, 
    width: '100%', 
    borderRadius: 15, 
    alignItems: 'center', 
    marginTop: 10 
  },
  confirmButtonText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  registerLink: { color: '#5876F1', marginTop: 20, fontSize: 18, textDecorationLine: 'underline' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  logoutAlertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  logoutAlertTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  logoutAlertMessage: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});