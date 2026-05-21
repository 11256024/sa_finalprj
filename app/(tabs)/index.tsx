import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
const API_URL = 'http://127.0.0.1:8000';
export default function LoginScreen() {
  const router = useRouter(); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState(''); 
  
  // 建立兩個 Ref 用來控制焦點切換
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // 控制密碼可視性
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);

  // 保持全域登入狀態（預設未登入 false）
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 自訂防呆登出彈窗的顯示狀態
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // 頁面一載入，自動將滑鼠/焦點聚集在帳號欄位
  useEffect(() => {
    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 登入驗證與跳轉邏輯
 const handleLogin = async () => {
  if (!username.trim() || !password) {
    setErrorMsg('⚠️ 請輸入帳號與密碼！');
    setShowError(true);
    return;
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const isLengthValid = password.length >= 6;

  if (!hasUpperCase || !isLengthValid) {
    setErrorMsg('⚠️ 密碼請輸入一個大寫字母，且長度需大於或等於 6 位數！');
    setShowError(true);
    return;
  }

  setShowError(false);

  try {
    const response = await fetch(`${API_URL}/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password: password,
      }),
    });

    const data = await response.json();
    console.log('登入結果:', data);

    if (!data.success) {
      setErrorMsg(data.message || '⚠️ 帳號或密碼錯誤！');
      setShowError(true);
      return;
    }

    // 先清掉上一位使用者留下來的共用快取
await AsyncStorage.multiRemove([
  'userProfile',
  'user_profile',
  'user_name_key',
  'user_height_key',
  'height',
  'user_weight_key',
  'weight',
  'age',
  'account',
  'password',
]);

// 再寫入目前登入者資料
await AsyncStorage.setItem('user', JSON.stringify(data.member));
await AsyncStorage.setItem('member_id', String(data.member.id));
await AsyncStorage.setItem('current_user_id', String(data.member.id));
await AsyncStorage.setItem('account', data.member.username);
await AsyncStorage.setItem('password', password);

    setIsLoggedIn(true);

    if (data.member.role === 'admin') {
  if (Platform.OS === 'web') {
    localStorage.setItem('admin_logged_in', 'true');
  }

  router.replace('/admin-review');
} else {
  if (Platform.OS === 'web') {
    localStorage.removeItem('admin_logged_in');
  }

  // 一般使用者登入後先進會員中心
  router.replace('/profile');
}
  } catch (e) {
    console.error('登入失敗:', e);
    setErrorMsg('⚠️ 無法連接後端，請確認 Django 是否已啟動！');
    setShowError(true);
  }
};

  // 確認登出動作
  const handleConfirmLogout = () => {
    setIsLoggedIn(false);         
    setUsername('');              
    setPassword('');
    if (Platform.OS === 'web') {
      localStorage.removeItem('admin_logged_in');
    }
    setLogoutModalVisible(false); 
  };

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.content}>
        <Text style={styles.pageTitle}>登 入</Text>
        
        <View style={styles.cardContainer}>
          <View style={styles.inputContainer}>
            
            {/* 帳號欄位：支援英文字母與數字，禁用中文/特殊符號 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>帳 號</Text>
              <TextInput 
                ref={usernameRef}
                style={styles.input} 
                placeholder="請輸入帳號 (限用英文字母與數字)"
                placeholderTextColor="#A9A9A9"
                value={username}
                onChangeText={(text) => { 
                  // 🎯 允許輸入大小寫英文字母 (a-zA-Z) 與數字 (0-9)
                  setUsername(text.replace(/[^a-zA-Z0-9]/g, '')); 
                  setShowError(false); 
                }}
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* 密碼欄位：支援英文字母與數字，禁用中文/特殊符號 */}
            <View style={[styles.inputGroup, { marginBottom: 10, borderBottomWidth: 0 }]}>
              <Text style={styles.label}>密 碼</Text>
              <View style={styles.passwordRow}>
                <TextInput 
                  ref={passwordRef}
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="請輸入密碼 (限用英文字母與數字)"
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={isPasswordSecure}
                  value={password}
                  onChangeText={(text) => { 
                    // 🎯 核心修改：密碼同樣利用 Regex 限制只能輸入大小寫英文字母與數字，直接禁用中文
                    setPassword(text.replace(/[^a-zA-Z0-9]/g, '')); 
                    setShowError(false); 
                  }}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setIsPasswordSecure(!isPasswordSecure)}
                >
                  <Ionicons 
                    name={isPasswordSecure ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 警示與提示區 */}
            <View style={styles.hintArea}>
              {showError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : (
                <Text style={styles.hintText}>
                  * 帳號與密碼限用英文字母與數字。{"\n"}
                  * 密碼必須至少輸入一個大寫字母，且長度需大於或等於 6 位數！
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
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC' },
  pageTitle: { fontSize: 36, marginBottom: 30, color: '#333', fontWeight: 'bold' },
  cardContainer: { backgroundColor: 'white', width: '45%', minWidth: 420, padding: 40, borderRadius: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 },
  inputContainer: { width: '100%' },
  inputGroup: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc', width: '100%' },
  label: { fontSize: 20, color: '#333', fontWeight: '600', marginBottom: 5 },
  input: { fontSize: 16, color: '#333', paddingVertical: 10, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ccc', width: '100%' },
  eyeButton: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
  hintArea: { minHeight: 75, marginTop: 15, marginBottom: 15 },
  errorBox: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FF4D4F', borderRadius: 8, padding: 10 },
  errorText: { color: '#FF4D4F', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hintText: { fontSize: 13, color: '#888', lineHeight: 18, paddingHorizontal: 5 },
  confirmButton: { backgroundColor: '#F3B07E', paddingVertical: 14, width: '100%', borderRadius: 15, alignItems: 'center', marginTop: 10 },
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