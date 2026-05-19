import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react'; // 💡 引入 useEffect 和 useRef
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// 💡 引入 Expo 內建圖示
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 狀態管理
  const [formatError, setFormatError] = useState(false);
  const [matchError, setMatchError] = useState(false);

  // 💡 密碼可視性狀態（各自獨立控制）
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);
  const [isConfirmPasswordSecure, setIsConfirmPasswordSecure] = useState(true);

  // 💡 建立三個欄位的 Ref 焦點控制
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // 💡 頁面一載入，自動聚焦在帳號欄位
  useEffect(() => {
    const timer = setTimeout(() => {
      usernameRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRegister = () => {
    // 💡 密碼強度驗證修改：長度至少 6 位，且必須包含至少一個大寫英文字母
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

    // 驗證成功，重置錯誤狀態並跳轉
    setFormatError(false);
    setMatchError(false);
    router.push('/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.7}>
            <Text style={styles.headerTitle}>食半功倍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 核心滾動區域 */}
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
                ref={usernameRef} // 💡 綁定 Ref
                style={styles.input} 
                placeholder="請輸入帳號(限用英文字母)" 
                placeholderTextColor="#A9A9A9"
                value={username}
                // 💡 強制過濾非英文字母
                onChangeText={(text) => {
                  setUsername(text.replace(/[^a-zA-Z]/g, ''));
                }}
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordRef.current?.focus()} // 💡 按 Enter 跳密碼
              />
            </View>

            {/* 密碼 */}
            <View style={[styles.inputGroup, { marginBottom: 10, borderBottomWidth: 0 }]}>
              <Text style={styles.label}>密 碼</Text>
              {/* 💡 密碼橫向排列容器 */}
              <View style={styles.passwordRow}>
                <TextInput 
                  ref={passwordRef} // 💡 綁定 Ref
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="請輸入密碼(限用英文字母)" 
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={isPasswordSecure}
                  value={password}
                  onChangeText={(text) => { setPassword(text); setFormatError(false); setMatchError(false); }}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()} // 💡 按 Enter 跳確認密碼
                />
                {/* 眼睛按鈕 */}
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

            {/* 提示字改為新規則 */}
            <Text style={styles.hintText}>
              * 必須至少輸入一個大寫字母，且長度需大於或等於 6 位數！
            </Text>

            {/* 確認密碼 */}
            <View style={[styles.inputGroup, { marginBottom: 10, marginTop: 10, borderBottomWidth: 0 }]}>
              <Text style={styles.label}>確 認 密 碼</Text>
              {/* 💡 確認密碼橫向排列容器 */}
              <View style={styles.passwordRow}>
                <TextInput 
                  ref={confirmPasswordRef} // 💡 綁定 Ref
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="請再次輸入密碼(限用英文字母)" 
                  placeholderTextColor="#A9A9A9"
                  secureTextEntry={isConfirmPasswordSecure}
                  value={confirmPassword}
                  onChangeText={(text) => { setConfirmPassword(text); setFormatError(false); setMatchError(false); }}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister} // 💡 按 Enter 直接送出註冊！
                />
                {/* 眼睛按鈕 */}
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
              <Text style={styles.errorText}>❌ 請輸入一個大寫字母，且長度需大於或等於 6 位數！</Text>
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
            <Text style={styles.buttonText}>確 認</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30,
    zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },

  scrollContent: { 
    minHeight: '100%',
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F5F5DC', 
    paddingTop: 60,      
    paddingBottom: 60     
  },
  pageTitle: { fontSize: 36, marginBottom: 30, color: '#333', fontWeight: 'bold' },
  registerCard: {
    backgroundColor: 'white', width: '45%', minWidth: 420, padding: 40,
    borderRadius: 30, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  inputContainer: { width: '100%' },
  inputGroup: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  label: { fontSize: 20, color: '#333', fontWeight: '600', marginBottom: 5 },
  
  input: { 
    fontSize: 16, 
    color: '#333', 
    paddingVertical: 10,
    ...Platform.select({ web: { outlineStyle: 'none' as any } })
  },
  
  // 💡 密碼欄位的橫向包裝樣式（與登入頁面完全對齊）
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    width: '100%',
  },
  eyeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  hintText: { fontSize: 13, color: '#888', marginBottom: 15, lineHeight: 18 },

  errorContainer: {
    backgroundColor: '#FCE8E6',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  errorText: {
    color: '#C53929',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  button: { backgroundColor: '#F3B07E', paddingVertical: 14, width: '100%', borderRadius: 15, alignItems: 'center', marginTop: 25 },
  buttonText: { color: 'white', fontSize: 22, fontWeight: 'bold' }
});