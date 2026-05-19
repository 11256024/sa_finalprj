import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 狀態管理
  const [formatError, setFormatError] = useState(false);
  const [matchError, setMatchError] = useState(false);

  const handleRegister = () => {
    // 正確的正規表達式驗證：大寫、小寫、數字、特殊字元，且至少8字元
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\.!\?@])[A-Za-z\d\.!\?@]{8,}$/;

    if (!passwordRegex.test(password)) {
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
      
      {/* 頂部導覽列 - 🎯 已移除多餘選單，保留可點擊回登入頁的「食半功倍」 */}
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
                style={styles.input} 
                placeholder="請輸入帳號" 
                placeholderTextColor="#A9A9A9"
                value={username}
                onChangeText={setUsername}
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
                onChangeText={(text) => { setPassword(text); setFormatError(false); setMatchError(false); }}
              />
            </View>

            <Text style={styles.hintText}>
              * 需包含至少一個大寫英文字母；一個小寫英文字母；一個數字；一個特殊字元，如：.!?@；且長度至少 8 字元。
            </Text>

            {/* 確認密碼 */}
            <View style={[styles.inputGroup, { marginBottom: 10, marginTop: 10 }]}>
              <Text style={styles.label}>確 認 密 碼</Text>
              <TextInput 
                style={styles.input} 
                placeholder="請再次輸入密碼" 
                placeholderTextColor="#A9A9A9"
                secureTextEntry={true}
                value={confirmPassword}
                onChangeText={(text) => { setConfirmPassword(text); setFormatError(false); setMatchError(false); }}
              />
            </View>
          </View>

          {/* 警示框區塊 */}
          {formatError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ 需包含至少一個大寫英文字母；一個小寫英文字母；一個數字；一個特殊字元，如：.!?@；且長度至少 8 字元！</Text>
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

  // 滾動內容排版優化間距
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
  
  // 🎯 修正處：將 Web 專屬的點選外框樣式（outlineStyle）正確寫在 style 裡面
  input: { 
    fontSize: 16, 
    color: '#333', 
    paddingVertical: 10,
    ...Platform.select({ web: { outlineStyle: 'none' as any } })
  },
  
  hintText: { fontSize: 13, color: '#888', marginBottom: 15, lineHeight: 18 },

  // 警示框樣式
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