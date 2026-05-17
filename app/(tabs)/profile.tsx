import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  // 1. 控制目前是「瀏覽狀態」還是「編輯狀態」
  const [isEditing, setIsEditing] = useState(false);

  // 2. 控制各個防呆彈窗的顯示狀態
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);       
  const [cancelModalVisible, setCancelModalVisible] = useState(false);   

  // 3. 個人資訊的狀態管理（未來這整段資料會從 useEffect 打 API get 撈回來）
  const [profileData, setProfileData] = useState({
    name: '王小明',
    birthday: '1995-08-15',
    height: '175',
    weight: '70',
    gender: '男',
    account: 'xiaoming123',
    password: 'Password123!', // 實際開發時，基於安全隱私，後端通常不會把密碼明碼丟給前端
  });

  // 暫存編輯中的數據
  const [tempData, setTempData] = useState({ ...profileData });

  // 獨立管理密碼修改輸入框
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // 4. 大頭貼圖片狀態
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // 選單選值範圍設定
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString()); 
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  
  const genderOptions = ['男', '女'];

  // 根據開啟 App 的當前時間，動態計算精準年齡
  const calculateAge = (birthdayStr: string) => {
    if (!birthdayStr) return '';
    const birthDate = new Date(birthdayStr);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? ` (${age} 歲)` : '';
  };

  // 選擇大頭貼功能
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        window.alert('我們需要讀取檔案的權限來更換大頭貼！');
      } else {
        Alert.alert('權限拒絕', '我們需要讀取檔案的權限來更換大頭貼！');
      }
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  // 點擊編輯或進入儲存確認流程
  const handleEditPress = () => {
    if (isEditing) {
      // 儲存前基礎欄位空值防呆驗證
      if (!tempData.name.trim() || !tempData.birthday || !tempData.account.trim()) {
        if (Platform.OS === 'web') {
          window.alert("請注意，基本資料欄位均不可留白！");
        } else {
          Alert.alert("無法儲存", "基本資料欄位均不可留白！");
        }
        return;
      }
      // 開啟儲存防呆彈窗
      setSaveModalVisible(true);
    } else {
      setTempData({ ...profileData });
      setIsEditing(true);
    }
  };

  // 🎯 確定執行儲存（未來這裡直接改寫成打 Axios / Fetch POST API）
  const handleConfirmSave = async () => {
    setSaveModalVisible(false);

    try {
      /* // 💡 未來連後端資料庫的寫法範例：
      const response = await axios.post('https://api.yourdomain.com/user/update', {
        name: tempData.name,
        birthday: tempData.birthday,
        height: tempData.height,
        weight: tempData.weight,
        gender: tempData.gender,
        account: tempData.account
      });
      */

      // 目前先更新前端狀態與 LocalStorage 供展示
      setProfileData({ ...tempData });
      setIsEditing(false);
      
      if (Platform.OS === 'web') {
        localStorage.setItem('user_profile', JSON.stringify({ ...tempData }));
        window.alert("個人資料已成功更新！");
      } else {
        Alert.alert("成功", "個人資料已成功更新！");
      }
    } catch (error) {
      // 錯誤處理
    }
  };

  // 點擊取消按鈕觸發防呆
  const handleCancelPress = () => {
    setCancelModalVisible(true);
  };

  // 確定放棄編輯切換回瀏覽模式
  const handleConfirmCancel = () => {
    setCancelModalVisible(false);
    setIsEditing(false);
  };

  // 🎯 驗證變更密碼（拿掉前端寫死的舊密碼比對，保留格式檢查，預留 API 位置）
  const handleSaveNewPassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      if (Platform.OS === 'web') window.alert("請完整填寫所有密碼欄位！");
      return;
    }
    if (newPassword.length < 8) {
      if (Platform.OS === 'web') window.alert("新密碼長度不足！密碼規則：長度必須至少為 8 位數！");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      if (Platform.OS === 'web') window.alert("確認新密碼不一致，請重新檢查！");
      return;
    }

    try {
      /* // 💡 未來連後端資料庫的寫法範例：
      // 舊密碼直接送到後端，讓後端去跟資料庫 Hash 密碼比對，如果錯誤，後端會回傳錯誤訊息
      const response = await axios.post('https://api.yourdomain.com/user/change-password', {
        oldPassword: oldPassword,
        newPassword: newPassword
      });

      if (response.data.success === false) {
        window.alert(response.data.message); // 例如：後端回傳「舊密碼輸入錯誤」
        return;
      }
      */

      // 模擬成功後的前端處理
      const updatedProfile = { ...profileData, password: newPassword };
      setProfileData(updatedProfile);
      
      if (Platform.OS === 'web') {
        localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
      }

      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      if (Platform.OS === 'web') {
        window.alert("密碼已變更成功！安全起見，系統將強制登出，請使用新密碼重新登入。");
        router.replace('/'); 
      } else {
        Alert.alert("變更成功", "密碼已變更成功！安全起見，系統將強制登出，請使用新密碼重新登入。", [
          { text: "確定", onPress: () => router.replace('/') }
        ]);
      }
    } catch (error) {
      if (Platform.OS === 'web') window.alert("密碼變更失敗，請稍後再試！");
    }
  };

  // 確定手動登出
  const handleConfirmLogout = () => {
    setLogoutModalVisible(false);
    if (Platform.OS === 'web') {
      window.alert("您已成功登出！");
      router.replace('/'); 
    } else {
      Alert.alert("提示", "您已成功登出！", [
        { text: "確定", onPress: () => router.replace('/') }
      ]);
    }
  };

  // 導覽列路由
  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') router.push('/profile');
    else if (menuName === '每日紀錄') router.push('/daily-record');
    else if (menuName === '歷史紀錄') router.push('/history');
    else if (menuName === '身體指數查詢') router.push('/body-metrics');
    else if (menuName === '查詢商品') router.push('/products');
    else if (menuName === '成就管理') router.push('/achievements');
  };

  const webSelectStyle = {
    fontSize: '16px',
    color: '#333',
    backgroundColor: '#F9F9F9',
    border: '1px solid #DDD',
    borderRadius: '8px',
    padding: '4px 10px',
    textAlign: 'right' as const,
    fontFamily: 'inherit',
    outline: 'none',
    width: '65%'
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <Text style={styles.headerTitle}>食半功倍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, styles.nonClickableText]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity style={styles.memberCenterBtnActive} onPress={() => handleMenuPress('會員中心')}>
            <Text style={styles.memberCenterText}>會員中心</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={() => setLogoutModalVisible(true)}>
            <Text style={styles.logoutHeaderBtnText}>登 出</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          
          {/* 左側欄位：頭像與姓名 */}
          <View style={styles.leftSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
              <View style={styles.editIconBadge}>
                <Text style={styles.editIconText}>✏️</Text>
              </View>
            </TouchableOpacity>

            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={tempData.name}
                onChangeText={(text) => setTempData({ ...tempData, name: text })}
              />
            ) : (
              <Text style={styles.memberName}>{profileData.name}</Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* 右側欄位：詳細表單 */}
          <View style={styles.rightSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生 日</Text>
              {isEditing && Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={tempData.birthday}
                  onChange={(e) => setTempData({ ...tempData, birthday: e.target.value })}
                  style={webSelectStyle}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {profileData.birthday}
                  <Text style={styles.ageHighlightText}>{calculateAge(profileData.birthday)}</Text>
                </Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>身 高 (cm)</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.height}
                  onChange={(e) => setTempData({ ...tempData, height: e.target.value })}
                  style={webSelectStyle}
                >
                  {heightOptions.map(h => <option key={h} value={h}>{h} cm</option>)}
                </select>
              ) : (
                <Text style={styles.infoValue}>{profileData.height} cm</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>體 重 (kg)</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.weight}
                  onChange={(e) => setTempData({ ...tempData, weight: e.target.value })}
                  style={webSelectStyle}
                >
                  {weightOptions.map(w => <option key={w} value={w}>{w} kg</option>)}
                </select>
              ) : (
                <Text style={styles.infoValue}>{profileData.weight} kg</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生理性別</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.gender}
                  onChange={(e) => setTempData({ ...tempData, gender: e.target.value })}
                  style={webSelectStyle}
                >
                  {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : (
                <Text style={styles.infoValue}>{profileData.gender}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>帳 號</Text>
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={tempData.account}
                  autoCapitalize="none"
                  onChangeText={(text) => setTempData({ ...tempData, account: text })}
                />
              ) : (
                <Text style={styles.infoValue}>{profileData.account}</Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>密 碼</Text>
              {isEditing ? (
                <TextInput
                  style={styles.inputField}
                  value={tempData.password}
                  secureTextEntry={true}
                  onChangeText={(text) => setTempData({ ...tempData, password: text })}
                />
              ) : (
                <Text style={styles.infoValue}>••••••••</Text>
              )}
            </View>

            {/* 按鈕操作區塊 */}
            <View style={styles.btnGroupRow}>
              {isEditing ? (
                <>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#ccc', marginRight: 15 }]} onPress={handleCancelPress}>
                    <Text style={styles.editBtnText}>取 消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#F3B07E' }]} onPress={handleEditPress}>
                    <Text style={styles.editBtnText}>儲 存</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#E67E22', marginRight: 15 }]} onPress={() => setPasswordModalVisible(true)}>
                    <Text style={styles.editBtnText}>更改密碼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#F3B07E' }]} onPress={handleEditPress}>
                    <Text style={styles.editBtnText}>編 輯</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 儲存防呆彈窗 */}
      <Modal animationType="fade" transparent={true} visible={saveModalVisible} onRequestClose={() => setSaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ 確認儲存變更嗎？</Text>
            <Text style={styles.alertMessage}>即將覆蓋並更新您最新的會員個人基本資料。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleConfirmSave}>
                <Text style={styles.modalBtnConfirmText}>確定儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 取消編輯防呆彈窗 */}
      <Modal animationType="fade" transparent={true} visible={cancelModalVisible} onRequestClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ 確定要取消嗎？</Text>
            <Text style={styles.alertMessage}>取消後，您剛才填寫的所有修改內容將會全數遺失。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setCancelModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>再想想</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#E74C3C' }]} onPress={handleConfirmCancel}>
                <Text style={styles.modalBtnConfirmText}>確定放棄</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 更改密碼彈窗 */}
      <Modal animationType="fade" transparent={true} visible={passwordModalVisible} onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passwordAlertContent}>
            <Text style={styles.passwordAlertTitle}>更 改 密 碼</Text>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>輸入舊密碼</Text>
              <TextInput style={styles.modalInputField} secureTextEntry={true} value={oldPassword} onChangeText={setOldPassword} placeholder="請輸入目前使用的密碼" />
            </View>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>設定新密碼（至少 8 位數）</Text>
              <TextInput style={styles.modalInputField} secureTextEntry={true} value={newPassword} onChangeText={setNewPassword} placeholder="請輸入符合規則的新密碼" />
            </View>
            <View style={styles.modalInputBlock}>
              <Text style={styles.modalInputLabel}>確認新密碼</Text>
              <TextInput style={styles.modalInputField} secureTextEntry={true} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="請再次輸入新密碼" />
            </View>
            <View style={[styles.modalButtonGroup, { marginTop: 15 }]}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => { setPasswordModalVisible(false); setOldPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleSaveNewPassword}>
                <Text style={styles.modalBtnConfirmText}>確認更改</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 登出防呆彈窗 */}
      <Modal animationType="fade" transparent={true} visible={logoutModalVisible} onRequestClose={() => setLogoutModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>確認要登出系統嗎？</Text>
            <Text style={styles.alertMessage}>登出後需要重新登入才能記錄您的每日飲食熱量唷！</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setLogoutModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleConfirmLogout}>
                <Text style={styles.modalBtnConfirmText}>確定登出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  header: { 
    height: 100, backgroundColor: '#A3C1AD', flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, zIndex: 10,
    ...Platform.select({ ios: { paddingTop: 20 }, android: { paddingTop: 10 } })
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8 },
  nonClickableText: { ...Platform.select({ web: { userSelect: 'none' } }) },
  
  headerRightGroup: { flexDirection: 'row', alignItems: 'center' },
  memberCenterBtnActive: { backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'white', marginRight: 15 },
  memberCenterText: { color: '#A3C1AD', fontSize: 16, fontWeight: 'bold' },
  logoutHeaderBtn: { backgroundColor: 'rgba(231, 76, 60, 0.8)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  logoutHeaderBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  profileCard: { backgroundColor: 'white', width: '55%', minWidth: 580, flexDirection: 'row', borderRadius: 40, padding: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  leftSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { width: 140, height: 140, marginBottom: 20, position: 'relative' },
  avatarPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E0E0E0' },
  avatarImage: { width: 140, height: 140, borderRadius: 70 },
  editIconBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'white', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  editIconText: { fontSize: 16 },
  memberName: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  nameInput: { fontSize: 20, fontWeight: 'bold', color: '#333', borderBottomWidth: 1, borderColor: '#ccc', textAlign: 'center', width: '80%', paddingVertical: 2 },
  
  divider: { width: 1, backgroundColor: '#EBEBEB', marginHorizontal: 40 },
  rightSection: { flex: 1.5, justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 6 },
  infoLabel: { fontSize: 18, color: '#333', fontWeight: '600' },
  infoValue: { fontSize: 18, color: '#666' },
  inputField: { flex: 0.7, fontSize: 16, color: '#333', backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#DDD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, textAlign: 'right' },
  btnGroupRow: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: 15 },
  editBtn: { paddingVertical: 10, paddingHorizontal: 35, borderRadius: 15 },
  editBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  ageHighlightText: { fontSize: 18, color: '#333', marginLeft: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },
  
  passwordAlertContent: { backgroundColor: '#FFF', width: 400, padding: 30, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  passwordAlertTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 25, textAlign: 'center', letterSpacing: 2 },
  modalInputBlock: { width: '100%', marginBottom: 16 },
  modalInputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  modalInputField: { width: '100%', fontSize: 16, color: '#333', backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },

  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' }, 
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});