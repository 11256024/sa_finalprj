import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// 引入跨平台本機資料庫套件
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileType {
  name: string;
  birthday: string;
  height: string;
  weight: string;
  gender: string;
  account: string;
  password: string;
  age?: string; // 補上年齡儲存欄位，以便與身體指數頁面做完美的對照
}

export default function ProfileScreen() {
  const router = useRouter();

  // 1. 狀態控制
  const [isEditing, setIsEditing] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);      
  const [cancelModalVisible, setCancelModalVisible] = useState(false);  

  // 2. 初始狀態設定（乾淨的空字串，完全不寫死）
  const [profileData, setProfileData] = useState<ProfileType>({
    name: '',
    birthday: '',
    height: '',
    weight: '',
    gender: '',
    account: 'xiaoming123',   // 帳號固定顯示
    password: 'yourpassword', // 密碼固定顯示
    age: ''
  });

  // 暫存編輯區（同步初始為空）
  const [tempData, setTempData] = useState<ProfileType>({ ...profileData });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // 📅 獲取今天日期的 YYYY-MM-DD 格式，用來限制網頁端生日最大值
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 頁面初始化載入
  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      // 雙重讀取保險：優先讀取新格式，沒有再看舊格式
      let localData = await AsyncStorage.getItem('userProfile');
      if (!localData) {
        localData = await AsyncStorage.getItem('user_profile');
      }
      
      const savedAvatar = await AsyncStorage.getItem('user_avatar');

      if (localData) {
        const parsedData = JSON.parse(localData);
        setProfileData(parsedData);
        setTempData(parsedData);
      }
      if (savedAvatar) {
        setAvatarUri(savedAvatar);
      }
    } catch (error) {
      console.error("加載使用者本機快取資料失敗：", error);
    }
  };

  // 下拉選單資料源
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString());
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  
  const genderOptions = ['男', '女'];

  // 計算純數字年齡（用於寫入資料庫，不帶有「歲」字樣方便其他頁面加減計算）
  const getPureAgeValue = (birthdayStr: string): string => {
    if (!birthdayStr) return '';
    const birthDate = new Date(birthdayStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age.toString() : '';
  };

  // 顯示在畫面的年齡標籤
  const renderAgeLabel = (birthdayStr: string) => {
    const ageNum = getPureAgeValue(birthdayStr);
    return ageNum ? ` (${ageNum} 歲)` : '';
  };

  // 大頭貼更換
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') window.alert('我們需要讀取檔案的權限來更換大頭貼！');
      else Alert.alert('權限拒絕', '我們需要讀取檔案的權限來更換大頭貼！');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      setAvatarUri(selectedUri);
      try {
        await AsyncStorage.setItem('user_avatar', selectedUri);
      } catch (e) {
        console.log('保存頭像快取失敗', e);
      }
    }
  };

  // 錯誤警告彈窗
  const showWarningAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`儲存失敗\n\n⚠️ ${message}`);
    } else {
      Alert.alert("儲存失敗", `⚠️ ${message}`);
    }
  };

  // 表單驗證防呆
  const handleEditPress = () => {
    if (isEditing) {
      if (!tempData.name || tempData.name.trim() === '') {
        showWarningAlert('姓名欄位不可留白，請輸入姓名！');
        return;
      }
      if (!tempData.birthday || tempData.birthday.trim() === '') {
        showWarningAlert('生日欄位不可留白，請選擇生日！');
        return;
      }
      if (!tempData.height || tempData.height.trim() === '') {
        showWarningAlert('身高欄位不可留白，請選擇身高！');
        return;
      }
      if (!tempData.weight || tempData.weight.trim() === '') {
        showWarningAlert('體重欄位不可留白，請選擇體重！');
        return;
      }
      if (!tempData.gender || tempData.gender.trim() === '') {
        showWarningAlert('生理性別欄位不可留白，請選擇性別！');
        return;
      }

      setSaveModalVisible(true);
    } else {
      setTempData({ ...profileData });
      setIsEditing(true);
    }
  };

  // 確認儲存：將年齡、身高、體重完好打包同步至身體指數頁面
  const handleConfirmSave = async () => {
    setSaveModalVisible(false);
    try {
      // 動態算出純數字年齡並同步塞入物件
      const calculatedAgeStr = getPureAgeValue(tempData.birthday);
      const updatedData = {
        ...tempData,
        age: calculatedAgeStr
      };

      // 1. 更新內部狀態
      setProfileData(updatedData);
      setIsEditing(false);

      // 2. 雙重寫入全功能萬用打包物件
      const stringifiedData = JSON.stringify(updatedData);
      await AsyncStorage.setItem('userProfile', stringifiedData);
      await AsyncStorage.setItem('user_profile', stringifiedData);

      // 3. 關鍵直通車：將關鍵欄位單獨提領存放
      if (updatedData.height) {
        await AsyncStorage.setItem('height', updatedData.height.toString());
      }
      if (updatedData.weight) {
        await AsyncStorage.setItem('weight', updatedData.weight.toString());
      }
      if (updatedData.age) {
        await AsyncStorage.setItem('age', updatedData.age.toString());
      }

      if (Platform.OS === 'web') {
        window.alert("個人資料已成功更新！飲食紀錄與身體指數已同步連動。");
      } else {
        Alert.alert("成功", "個人資料已成功更新！飲食紀錄與身體指數已同步連動。");
      }
    } catch (error) {
      console.error("儲存本機動態資料庫失敗：", error);
    }
  };

  const handleCancelPress = () => {
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = () => {
    setCancelModalVisible(false);
    setIsEditing(false);
  };

  const handleConfirmLogout = () => {
    setLogoutModalVisible(false);
    if (Platform.OS === 'web') {
      window.alert("您已成功登出！");
      router.replace('/');
    } else {
      Alert.alert("提示", "您已成功登出！", [{ text: "確定", onPress: () => router.replace('/') }]);
    }
  };

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
                placeholder="請輸入姓名"
                placeholderTextColor="#A9A9A9"
                onChangeText={(text) => setTempData({ ...tempData, name: text })}
              />
            ) : (
              <Text style={[styles.memberName, !profileData.name && styles.placeholderText]}>
                {profileData.name || '請輸入姓名'}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* 右側欄位：詳細表單 */}
          <View style={styles.rightSection}>
            
            {/* 生日欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生 日</Text>
              {isEditing && Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={tempData.birthday}
                  max={getTodayDateString()} 
                  onChange={(e) => setTempData({ ...tempData, birthday: e.target.value })}
                  style={webSelectStyle}
                />
              ) : (
                <Text style={[styles.infoValue, !profileData.birthday && styles.placeholderText]}>
                  {profileData.birthday ? (
                    <>
                      {profileData.birthday}
                      <Text style={styles.ageHighlightText}>{renderAgeLabel(profileData.birthday)}</Text>
                    </>
                  ) : (
                    '請選擇生日'
                  )}
                </Text>
              )}
            </View>

            {/* 身高欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>身 高 (cm)</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.height}
                  onChange={(e) => setTempData({ ...tempData, height: e.target.value })}
                  style={webSelectStyle}
                >
                  <option value="">請選擇身高</option>
                  {heightOptions.map(h => <option key={h} value={h}>{h} cm</option>)}
                </select>
              ) : (
                <Text style={[styles.infoValue, !profileData.height && styles.placeholderText]}>
                  {profileData.height ? `${profileData.height} cm` : '請選擇身高'}
                </Text>
              )}
            </View>

            {/* 體重欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>體 重 (kg)</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.weight}
                  onChange={(e) => setTempData({ ...tempData, weight: e.target.value })}
                  style={webSelectStyle}
                >
                  <option value="">請選擇體重</option>
                  {weightOptions.map(w => <option key={w} value={w}>{w} kg</option>)}
                </select>
              ) : (
                <Text style={[styles.infoValue, !profileData.weight && styles.placeholderText]}>
                  {profileData.weight ? `${profileData.weight} kg` : '請選擇體重'}
                </Text>
              )}
            </View>

            {/* 性別欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生理性別</Text>
              {isEditing && Platform.OS === 'web' ? (
                <select
                  value={tempData.gender}
                  onChange={(e) => setTempData({ ...tempData, gender: e.target.value })}
                  style={webSelectStyle}
                >
                  <option value="">請選擇性別</option>
                  {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : (
                <Text style={[styles.infoValue, !profileData.gender && styles.placeholderText]}>
                  {profileData.gender || '請選擇性別'}
                </Text>
              )}
            </View>

            {/* 帳號欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>帳 號</Text>
              <Text style={[styles.infoValue, styles.readOnlyText]}>
                {profileData.account}
              </Text>
            </View>

            {/* 密碼欄位 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>密 碼</Text>
              <Text style={[styles.infoValue, styles.readOnlyText]}>
                ••••••••
              </Text>
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
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#E67E22' }]} onPress={handleEditPress}>
                    <Text style={styles.editBtnText}>編 輯</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 儲存確認彈窗 */}
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

      {/* 取消變更確認彈窗 */}
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

      {/* 登出確認彈窗 */}
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
  placeholderText: { color: '#A9A9A9', fontWeight: 'normal' },
  
  nameInput: { fontSize: 20, fontWeight: 'bold', color: '#333', borderBottomWidth: 1, borderColor: '#ccc', textAlign: 'center', width: '80%', paddingVertical: 2, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  
  divider: { width: 1, backgroundColor: '#EBEBEB', marginHorizontal: 40 },
  rightSection: { flex: 1.5, justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 6 },
  infoLabel: { fontSize: 18, color: '#333', fontWeight: '600' },
  infoValue: { fontSize: 18, color: '#666' },
  
  readOnlyText: { color: '#777', ...Platform.select({ web: { cursor: 'not-allowed', userSelect: 'none' } }) },
  
  btnGroupRow: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: 15 },
  editBtn: { paddingVertical: 10, paddingHorizontal: 35, borderRadius: 15 },
  editBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  ageHighlightText: { fontSize: 18, color: '#333', marginLeft: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },

  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});