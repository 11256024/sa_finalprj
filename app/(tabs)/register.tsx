// 檔案說明：註冊頁面：處理新會員註冊表單、驗證與送出。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';

// 說明：RegisterScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function RegisterScreen() {
  // 說明：宣告 router，集中處理這段畫面邏輯會用到的資料或方法。
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 狀態管理
  const [formatError, setFormatError] = useState(false);
  const [matchError, setMatchError] = useState(false);
  
  // 🎯 控制「註冊成功提示框」的顯示狀態
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // 密碼可視性狀態
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);
  const [isConfirmPasswordSecure, setIsConfirmPasswordSecure] = useState(true);

  // 建立三個欄位的 Ref 焦點控制
  // 說明：保存 usernameRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const usernameRef = useRef<TextInput>(null);
  // 說明：保存 passwordRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const passwordRef = useRef<TextInput>(null);
  // 說明：保存 confirmPasswordRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const confirmPasswordRef = useRef<TextInput>(null);

  // 頁面一載入，自動聚焦在帳號欄位
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    // 說明：宣告 timer，集中處理這段畫面邏輯會用到的資料或方法。
    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleRegister = async () => {
    // ❌ 核心防禦一：帳號基本檢查 (不可空白，且長度至少大於等於 3 位)
    // 說明：宣告 trimmedUsername，集中處理這段畫面邏輯會用到的資料或方法。
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      alert('請輸入帳號');
      return;
    }
    if (trimmedUsername.length < 3) {
      alert('為了帳戶安全，帳號長度必須至少大於或等於 3 位數！');
      return;
    }

    // ❌ 核心防禦二：密碼強度驗證
    // 說明：宣告 hasUpperCase，集中處理這段畫面邏輯會用到的資料或方法。
    const hasUpperCase = /[A-Z]/.test(password);
    // 說明：宣告 isLengthValid，集中處理這段畫面邏輯會用到的資料或方法。
    const isLengthValid = password.length >= 6;

    if (!hasUpperCase || !isLengthValid) {
      setFormatError(true);
      setMatchError(false);
      return;
    }

    // ❌ 核心防禦三：防止密碼與帳號完全相同
    if (password.toLowerCase() === trimmedUsername.toLowerCase()) {
      alert('安全性警告：密碼不得與帳號名稱完全相同，請重新設定！');
      return;
    }

    // ❌ 核心防禦四：二次密碼一致性檢查
    if (password !== confirmPassword) {
      setMatchError(true);
      setFormatError(false);
      return;
    }

    // 驗證成功，重置錯誤狀態
    setFormatError(false);
    setMatchError(false);

    try {
      // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
      const response = await fetch(`${API_URL}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername, 
          password: password,
        }),
      });

      // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
      const data = await response.json();
      console.log('註冊結果:', data);

      if (data.success) {
        setSuccessModalVisible(true);
      } else {
        alert(data.message || '註冊失敗');
      }
    } catch (error) {
      console.log('註冊錯誤:', error);
      alert('無法連接後端，請確認 Django 是否已啟動。');
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleGoToLogin = () => {
    setSuccessModalVisible(false);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    router.replace('/'); 
  };

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <View style={{ flex: 1, backgroundColor: '#E0E7DA' }}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>帳 號 註 冊</Text>
        
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
                onChangeText={(text) => setUsername(text.replace(/[^a-zA-Z0-9]/g, ''))}
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
                <TouchableOpacity style={styles.eyeButton} onPress={() => setIsPasswordSecure(!isPasswordSecure)}>
                  <Ionicons name={isPasswordSecure ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
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
                <TouchableOpacity style={styles.eyeButton} onPress={() => setIsConfirmPasswordSecure(!isConfirmPasswordSecure)}>
                  <Ionicons name={isConfirmPasswordSecure ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
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
          <TouchableOpacity style={styles.button} onPress={handleRegister} activeOpacity={0.7}>
            <Text style={styles.buttonText}>確 認 註 冊</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 註冊成功提示彈窗 */}
      <Modal animationType="fade" transparent={true} visible={successModalVisible} onRequestClose={handleGoToLogin}>
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

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertTitle: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});