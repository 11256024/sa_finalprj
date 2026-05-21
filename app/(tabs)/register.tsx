import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
const API_URL = 'http://127.0.0.1:8000';
export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 狀態管理
  const [formatError, setFormatError] = useState(false);
  const [matchError, setMatchError] = useState(false);
  
  // 🎯 新增：控制「註冊成功提示框」的顯示狀態
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // 密碼可視性狀態（各自獨立控制）
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);
  const [isConfirmPasswordSecure, setIsConfirmPasswordSecure] = useState(true);

  // 建立三個欄位的 Ref 焦點控制
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // 頁面一載入，自動聚焦在帳號欄位
  useEffect(() => {
    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRegister = async () => {
  // 帳號不可空白
  if (!username.trim()) {
    alert('請輸入帳號');
    return;
  }

  // 密碼強度驗證：長度至少 6 位，且必須包含至少一個大寫英文字母
  const hasUpperCase = /[A-Z]/.test(password);
  const isLengthValid = password.length >= 6;

  if (!hasUpperCase || !isLengthValid) {
    setFormatError(true);
    setMatchError(false);
    return;
  }

  if (password !== confirmPassword) {
    setMatchError(true);
    setFormatError(false);
    return;
  }

  // 驗證成功，重置錯誤狀態
  setFormatError(false);
  setMatchError(false);

  try {
    const response = await fetch(`${API_URL}/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    const data = await response.json();
    console.log('註冊結果:', data);

    if (data.success) {
      // 保留你原本的成功提示框設計
      setSuccessModalVisible(true);
    } else {
      alert(data.message || '註冊失敗');
    }
  } catch (error) {
    console.log('註冊錯誤:', error);
    alert('無法連接後端');
  }
};

  // 🎯 新增：點選提示框的確定按鈕後，導向登入頁面
  const handleGoToLogin = () => {
    setSuccessModalVisible(false);
    
    // 清空輸入欄位（防污染）
    setUsername('');
    setPassword('');
    setConfirmPassword('');

    // 導向你的登入首頁 (請根據你的實際路徑調整，通常登入首頁是 '/' 或 '/login')
    router.replace('/'); 
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E0E7DA' }}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        {/* 標題文字 */}
        <Text style={styles.pageTitle}>帳 號 註 冊</Text>
        
        {/* 註冊卡片 */}
        <View style={styles.registerCard}>
          <View style={styles.inputContainer}>
            
            {/* 帳號名稱 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>帳 號 名 稱</Text>
              <TextInput 
                ref={usernameRef}
                style={styles.input} 
                placeholder="請輸入帳號 (限用英文字母與數字)" 
                placeholderTextColor="#A9A9A9"
                value={username}
                onChangeText={(text) => {
                  setUsername(text.replace(/[^a-zA-Z0-9]/g, ''));
                }}
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* 密碼 */}
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
                    setPassword(text.replace(/[^a-zA-Z0-9]/g, '')); 
                    setFormatError(false); 
                    setMatchError(false); 
                  }}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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

            {/* 密碼格式提示 */}
            <Text style={styles.hintText}>
              * 帳號與密碼限用英文字母與數字。{"\n"}
              * 密碼必須至少輸入一個大寫字母，且長度需大於或等於 6 位數！
            </Text>

            {/* 確認密碼 */}
            <View style={[styles.inputGroup, { marginBottom: 10, marginTop: 10, borderBottomWidth: 0 }]}>
              <Text style={styles.label}>確 認 密 碼</Text>
              <View style={styles.passwordRow}>
                <TextInput 
                  ref={confirmPasswordRef}
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="請再次輸入密碼 (限用英文字母與數字)" 
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={isConfirmPasswordSecure}
                  value={confirmPassword}
                  onChangeText={(text) => { 
                    setConfirmPassword(text.replace(/[^a-zA-Z0-9]/g, '')); 
                    setFormatError(false); 
                    setMatchError(false); 
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setIsConfirmPasswordSecure(!isConfirmPasswordSecure)}
                >
                  <Ionicons 
                    name={isConfirmPasswordSecure ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 警示框區塊 */}
          {formatError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ 密碼請輸入一個大寫字母，且長度需大於或等於 6 位數！</Text>
            </View>
          )}

          {matchError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ 兩次輸入的密碼不一致，請重新確認！</Text>
            </View>
          )}

          {/* 確認按鈕 */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleRegister}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>確 認 註 冊</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 🎯 新增：註冊成功提示彈窗 (對齊 Profile 的 Modal 設計風格) */}
      <Modal 
        animationType="fade" 
        transparent={true} 
        visible={successModalVisible} 
        onRequestClose={handleGoToLogin}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>🎉 註冊成功！</Text>
            <Text style={styles.alertMessage}>您的新帳號已成功建立。{"\n"}請返回登入頁面重新登入系統。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleGoToLogin}>
                <Text style={styles.modalBtnConfirmText}>前往登入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingTop: 60, paddingBottom: 60 },
  pageTitle: { fontSize: 36, marginBottom: 30, color: '#333', fontWeight: 'bold' },
  registerCard: { backgroundColor: 'white', width: '45%', minWidth: 420, padding: 40, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  inputContainer: { width: '100%' },
  inputGroup: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  label: { fontSize: 20, color: '#333', fontWeight: '600', marginBottom: 5 },
  input: { fontSize: 16, color: '#333', paddingVertical: 10, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ccc', width: '100%' },
  eyeButton: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
  hintText: { fontSize: 13, color: '#888', marginBottom: 15, lineHeight: 18 },
  errorContainer: { backgroundColor: '#FCE8E6', padding: 12, borderRadius: 10, marginTop: 15, width: '100%', borderWidth: 1, borderColor: '#F44336' },
  errorText: { color: '#C53929', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  button: { backgroundColor: '#F3B07E', paddingVertical: 14, width: '100%', borderRadius: 15, alignItems: 'center', marginTop: 25 },
  buttonText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  
  // 🎯 提示彈窗樣式 (與你的 Profile 樣式完美對齊)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertTitle: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
