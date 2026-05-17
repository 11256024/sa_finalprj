import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter(); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);

  // 頂部導覽列點擊事件
  const handleMenuPress = (menuName: string) => {
    Alert.alert("導航", `即將前往：${menuName}`);
  };

  // 登入驗證與跳轉邏輯
  const handleLogin = () => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[.!?@]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    
    // 驗證成功，直接跳轉到第三頁（會員中心）
    router.push('/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity onPress={() => handleMenuPress('首頁')}>
            <Text style={styles.headerTitle}>食半功倍</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={styles.headerMenu}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 右側會員中心按鈕已被完美移除，保持乾淨導覽列 */}
      </View>

      <View style={styles.content}>
        {/* 標題字體大小統一為 36 */}
        <Text style={styles.pageTitle}>登 入</Text>
        
        {/* 卡片樣式：與註冊頁完全同步 */}
        <View style={styles.cardContainer}>
          <View style={styles.inputContainer}>
            {/* 帳號 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>帳 號</Text>
              <TextInput 
                style={styles.input} 
                placeholder="請輸入帳號"
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
                secureTextEntry={true}
                value={password}
                onChangeText={(text) => { setPassword(text); setShowError(false); }}
              />
            </View>

            {/* 警示區：固定高度避免框的大小跳動 */}
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
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30 },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500' },
  
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
  input: { fontSize: 16, color: '#333', paddingVertical: 10 },
  
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
  registerLink: { color: '#5876F1', marginTop: 20, fontSize: 18, textDecorationLine: 'underline' }
});