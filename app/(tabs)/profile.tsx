import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ProfileType {
  name: string;
  birthday: string;
  height: string;
  weight: string;
  gender: string;
  account: string;  
  password: string;
  age?: string;
}

export default function ProfileScreen() {
  const router = useRouter();

  // 狀態控制
  const [isEditing, setIsEditing] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);      
  const [cancelModalVisible, setCancelModalVisible] = useState(false); 
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 控制大頭貼操作選單 Modal
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  // 控制刪除大頭貼防呆二次確認 Modal
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // 初始化個人資料狀態
  const [profileData, setProfileData] = useState<ProfileType>({
    name: '',
    birthday: '',
    height: '',
    weight: '',
    gender: '',
    account: '',  
    password: '',  
    age: ''
  });

  const [tempData, setTempData] = useState<ProfileType>({ ...profileData });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const savedUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';

      const userStr = await AsyncStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;

      const savedAccount = await AsyncStorage.getItem('account');
      const savedUsername = await AsyncStorage.getItem('username');
      const savedPassword = await AsyncStorage.getItem('password');

      const singleAccount =
        currentUser?.username ||
        currentUser?.account ||
        savedAccount ||
        savedUsername ||
        '';

      const singlePassword = savedPassword || '';

      let localData = await AsyncStorage.getItem(`${savedUserId}_user_profile`);
      let parsedProfile: any = {};
      if (localData) {
        try { parsedProfile = JSON.parse(localData); } catch (e) {}
      }

      let rawName = parsedProfile.name || '';
      let rawBirthday = parsedProfile.birthday || '';
      let rawHeight = parsedProfile.height || '';
      let rawWeight = parsedProfile.weight || '';
      let rawGender = parsedProfile.gender || '';

      const singleName = await AsyncStorage.getItem(`${savedUserId}_user_name_key`);
      const singleHeight = await AsyncStorage.getItem(`${savedUserId}_user_height`);
      const singleWeight = await AsyncStorage.getItem(`${savedUserId}_user_weight`);

      if (singleName) rawName = singleName;
      if (singleHeight) rawHeight = singleHeight;
      if (singleWeight) rawWeight = singleWeight;

      const cleanName = (rawName === '請輸入姓名' || rawName === '王小' || rawName === '王小明' || rawName === '你好' || rawName === 'xx') ? '' : rawName;
      const cleanBirthday = (rawBirthday === '請選擇生日' || rawBirthday === '1995-01-15') ? '' : rawBirthday;
      const cleanHeight = (rawHeight === '請選擇身高' || !rawHeight) ? '' : rawHeight.toString().trim();
      const cleanWeight = (rawWeight === '請選擇體重' || !rawWeight) ? '' : rawWeight.toString().trim();
      const cleanGender = (rawGender === '請選擇性別') ? '' : rawGender;

      const singleAge = await AsyncStorage.getItem(`${savedUserId}_user_age`);

      const safeData = {
        name: cleanName,
        birthday: cleanBirthday,
        height: cleanHeight,
        weight: cleanWeight,
        gender: cleanGender,
        account: singleAccount || parsedProfile.account || '',
        password: singlePassword || parsedProfile.password || '',
        age: singleAge || parsedProfile.age || ''
      };

      setProfileData(safeData);
      setTempData(safeData);

      const savedAvatar =
        await AsyncStorage.getItem(`${savedUserId}_user_avatar`) ||
        await AsyncStorage.getItem('user_avatar');

      if (savedAvatar) {
        setAvatarUri(savedAvatar);
      } else {
        setAvatarUri(null);
      }
    } catch (error) {
      console.error("加載快取失敗：", error);
    }
  };

  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString());
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  
  const genderOptions = ['男', '女'];

  const getPureAgeValue = (birthdayStr: string): string => {
    if (!birthdayStr || birthdayStr === '請選擇生日' || birthdayStr === '1995-01-15') return '';
    const birthDate = new Date(birthdayStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age.toString() : '';
  };

  const renderAgeLabel = (birthdayStr: string) => {
    const ageNum = getPureAgeValue(birthdayStr);
    return ageNum ? ` (${ageNum} 歲)` : '';
  };

  const openImagePicker = async () => {
    setAvatarMenuVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      setAvatarUri(imageUri);
      
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result as string;
          await AsyncStorage.setItem('user_avatar', base64Data);
          const currentUserId =
            await AsyncStorage.getItem('current_user_id') ||
            await AsyncStorage.getItem('member_id') ||
            'guest';
          await AsyncStorage.setItem(`${currentUserId}_user_avatar`, base64Data);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.log('⚠️ Base64 轉換失敗，使用原始 URI:', e);
        await AsyncStorage.setItem('user_avatar', imageUri);
        const currentUserId =
          await AsyncStorage.getItem('current_user_id') ||
          await AsyncStorage.getItem('member_id') ||
          'guest';
        await AsyncStorage.setItem(`${currentUserId}_user_avatar`, imageUri);
      }
    }
  };

  const handleConfirmDeleteImage = async () => {
    setDeleteConfirmVisible(false);
    setAvatarUri(null);
    try {
      await AsyncStorage.removeItem('user_avatar');
      const currentUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';
      await AsyncStorage.removeItem(`${currentUserId}_user_avatar`);
    } catch (e) {
      console.error("刪除圖片失敗：", e);
    }
  };

  const handleAvatarPress = () => {
    setAvatarMenuVisible(true);
  };

  const getFirstCharOfName = () => {
    const currentName = isEditing ? tempData.name : profileData.name;
    if (currentName && currentName.trim().length > 0) {
      const cleanText = currentName.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
      if (cleanText.length > 0) {
        return cleanText.charAt(0);
      }
    }
    return "👤";
  };

  const showWarningAlert = (message: string) => {
    if (Platform.OS === 'web') window.alert(`儲存失敗\n\n⚠️ ${message}`);
    else Alert.alert("儲存失敗", `⚠️ ${message}`);
  };

  const handleEditPress = () => {
    if (isEditing) {
      if (!tempData.name || tempData.name.trim() === '') { showWarningAlert('請輸入正確的姓名！'); return; }
      const cleanText = tempData.name.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');
      if (cleanText.length === 0) { showWarningAlert('姓名不能全為空白或符號！'); return; }

      if (!tempData.birthday || tempData.birthday.trim() === '') { showWarningAlert('請選擇生日！'); return; }
      if (!tempData.height || tempData.height.trim() === '') { showWarningAlert('請選擇身高！'); return; }
      if (!tempData.weight || tempData.weight.trim() === '') { showWarningAlert('請選擇體重！'); return; }
      if (!tempData.gender || tempData.gender.trim() === '') { showWarningAlert('請選擇生理性別！'); return; }

      setSaveModalVisible(true);
    } else {
      setTempData({ ...profileData });
      setIsEditing(true);
    }
  };

  const handleConfirmSave = async () => {
    setSaveModalVisible(false);
    try {
      const savedUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';
      const calculatedAgeStr = getPureAgeValue(tempData.birthday);
      const updatedData = {
        ...tempData,
        account: profileData.account,
        password: profileData.password,
        age: calculatedAgeStr,
      };

      setProfileData(updatedData);
      setIsEditing(false);

      const stringifiedData = JSON.stringify(updatedData);
      
      await AsyncStorage.setItem(`${savedUserId}_user_profile`, stringifiedData);
      await AsyncStorage.setItem(`${savedUserId}_user_name_key`, updatedData.name.trim());
      await AsyncStorage.setItem(`${savedUserId}_user_height`, updatedData.height);
      await AsyncStorage.setItem(`${savedUserId}_user_weight`, updatedData.weight);

      if (updatedData.age) {
        await AsyncStorage.setItem(`${savedUserId}_user_age`, updatedData.age);
      }

      if (Platform.OS === 'web') window.alert("個人資料已成功更新！");
      else Alert.alert("成功", "個人資料已成功更新！");
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelPress = () => {
    const isChanged = 
      tempData.name !== profileData.name ||
      tempData.birthday !== profileData.birthday ||
      tempData.height !== profileData.height ||
      tempData.weight !== profileData.weight ||
      tempData.gender !== profileData.gender;

    if (isChanged) {
      setCancelModalVisible(true);
    } else {
      setIsEditing(false);
    }
  };

  const handleConfirmCancel = () => {
    setCancelModalVisible(false);
    setIsEditing(false);
  };

  const webSelectStyle = {
    fontSize: '16px',
    color: '#333',
    backgroundColor: '#F9F9F9',
    border: '1px solid #DDD',
    borderRadius: '8px',
    padding: '4px 10px',
    textAlign: 'right' as const,
    width: '65%',
    outline: 'none',
    cursor: 'pointer'
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          
          {/* 左側欄位（大頭貼與姓名） */}
          <View style={styles.leftSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarTextPlaceholder}>
                  <Text style={styles.avatarTextLabel}>{getFirstCharOfName()}</Text>
                </View>
              )}
              <View style={styles.editIconBadge}><Text style={styles.editIconText}>✏️</Text></View>
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
              <Text style={[styles.memberName, (!profileData.name || profileData.name.trim() === '') && styles.placeholderText]}>
                {!profileData.name || profileData.name.trim() === '' ? '請輸入姓名' : profileData.name}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* 右側欄位 */}
          <View style={styles.rightSection}>
            
            {/* 生日 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生 日</Text>
              {isEditing ? (
                Platform.OS === 'web' ? (
                  /* 🟢 修正：使用相對定位包裹，並加一個透明覆蓋層阻斷左側文字區的點擊 */
                  <div style={{ width: '65%', position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
                    <input
                      id="web-birthday-picker"
                      type="date"
                      value={tempData.birthday}
                      max={getTodayDateString()}
                      onChange={(e) => setTempData({ ...tempData, birthday: e.target.value })}
                      style={{ ...webSelectStyle, width: '100%' }}
                    />
                    {/* 透明透明點擊層：寬度 82% 剛好避開最右側的日曆小圖標，避免重複觸發 */}
                    <div 
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '82%',
                        height: '100%',
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => {
                        const inputEl = document.getElementById('web-birthday-picker') as any;
                        if (inputEl && typeof inputEl.showPicker === 'function') {
                          inputEl.showPicker();
                        }
                      }}
                    />
                  </div>
                ) : (
                  <TextInput
                    style={styles.textInputRight}
                    value={tempData.birthday}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A9A9A9"
                    onChangeText={(text) => setTempData({ ...tempData, birthday: text })}
                  />
                )
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.infoValue, (!profileData.birthday || profileData.birthday === '') && styles.placeholderText]}>
                    {!profileData.birthday || profileData.birthday === '' ? '請選擇生日' : profileData.birthday}
                  </Text>
                  {profileData.birthday ? <Text style={styles.ageHighlightText}>{renderAgeLabel(profileData.birthday)}</Text> : null}
                </View>
              )}
            </View>

            {/* 身高 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>身 高 (cm)</Text>
              {isEditing ? (
                Platform.OS === 'web' ? (
                  <select
                    value={tempData.height}
                    onChange={(e) => setTempData({ ...tempData, height: e.target.value })}
                    style={webSelectStyle}
                  >
                    <option value="">請選擇身高</option>
                    {heightOptions.map(h => <option key={h} value={h}>{h} cm</option>)}
                  </select>
                ) : (
                  <TextInput
                    style={styles.textInputRight}
                    value={tempData.height}
                    placeholder="請選擇身高"
                    placeholderTextColor="#A9A9A9"
                    keyboardType="numeric"
                    onChangeText={(text) => setTempData({ ...tempData, height: text })}
                  />
                )
              ) : (
                <Text style={[styles.infoValue, (!profileData.height || profileData.height === '') && styles.placeholderText]}>
                  {!profileData.height || profileData.height === '' ? '請選擇身高' : `${profileData.height} cm`}
                </Text>
              )}
            </View>

            {/* 體重 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>體 重 (kg)</Text>
              {isEditing ? (
                Platform.OS === 'web' ? (
                  <select
                    value={tempData.weight}
                    onChange={(e) => setTempData({ ...tempData, weight: e.target.value })}
                    style={webSelectStyle}
                  >
                    <option value="">請選擇體重</option>
                    {weightOptions.map(w => <option key={w} value={w}>{w} kg</option>)}
                  </select>
                ) : (
                  <TextInput
                    style={styles.textInputRight}
                    value={tempData.weight}
                    placeholder="請選擇體重"
                    placeholderTextColor="#A9A9A9"
                    keyboardType="numeric"
                    onChangeText={(text) => setTempData({ ...tempData, weight: text })}
                  />
                )
              ) : (
                <Text style={[styles.infoValue, (!profileData.weight || profileData.weight === '') && styles.placeholderText]}>
                  {!profileData.weight || profileData.weight === '' ? '請選擇體重' : `${profileData.weight} kg`}
                </Text>
              )}
            </View>

            {/* 性別 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>生理性別</Text>
              {isEditing ? (
                Platform.OS === 'web' ? (
                  <select
                    value={tempData.gender}
                    onChange={(e) => setTempData({ ...tempData, gender: e.target.value })}
                    style={webSelectStyle}
                  >
                    <option value="">請選擇性別</option>
                    {genderOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <TextInput
                    style={styles.textInputRight}
                    value={tempData.gender}
                    placeholder="請選擇性別"
                    placeholderTextColor="#A9A9A9"
                    onChangeText={(text) => setTempData({ ...tempData, gender: text })}
                  />
                )
              ) : (
                <Text style={[styles.infoValue, (!profileData.gender || profileData.gender === '') && styles.placeholderText]}>
                  {!profileData.gender || profileData.gender === '' ? '請選擇性別' : profileData.gender}
                </Text>
              )}
            </View>

            {/* 帳號 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>帳 號</Text>
              <Text style={[styles.infoValue, styles.readOnlyText, (!profileData.account || profileData.account.trim() === '') && styles.placeholderText]}>
                {profileData.account && profileData.account.trim() !== '' ? profileData.account : '請輸入帳號'}
              </Text>
            </View>

            {/* 密碼 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>密 碼</Text>
              <View style={styles.passwordContainer}>
                <Text style={[styles.infoValue, styles.readOnlyText, (!profileData.password || profileData.password.trim() === '') && styles.placeholderText]}>
                  {!profileData.password || profileData.password.trim() === ''
                    ? '請輸入密碼'
                    : (isPasswordVisible ? profileData.password : '••••••••')
                  }
                </Text>
                
                {profileData.password && profileData.password.trim() !== '' && (
                  <TouchableOpacity
                    style={styles.customEyeButton}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.eyeShape}>
                      <Text style={styles.eyeText}>👁</Text>
                      {!isPasswordVisible && <View style={styles.eyeSlashLine} />}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 按鈕組 */}
            <View style={styles.btnGroupRow}>
              {isEditing ? (
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#ccc', marginRight: 15 }]} onPress={handleCancelPress}>
                    <Text style={styles.editBtnText}>取 消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#F3B07E' }]} onPress={handleEditPress}>
                    <Text style={styles.editBtnText}>儲 存</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#E67E22' }]} onPress={handleEditPress}>
                  <Text style={styles.editBtnText}>編 輯</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 自訂選單 Modal */}
      <Modal animationType="fade" transparent={true} visible={avatarMenuVisible} onRequestClose={() => setAvatarMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>🖼️ 編輯大頭貼</Text>
            <Text style={styles.alertMessage}>請選擇您想執行的操作：</Text>
            
            <TouchableOpacity style={styles.menuActionButton} onPress={openImagePicker}>
              <Text style={styles.menuActionTextPrimary}>更換新圖片</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuActionButton, { borderColor: '#E74C3C' }]} 
              onPress={() => {
                setAvatarMenuVisible(false);
                setDeleteConfirmVisible(true);
              }}
            >
              <Text style={styles.menuActionTextDanger}>刪除大頭貼</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuActionButton, { borderBottomWidth: 0, marginTop: 10 }]} onPress={() => setAvatarMenuVisible(false)}>
              <Text style={styles.menuActionTextCancel}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 刪除圖片時的「二次確認」防呆 Modal */}
      <Modal animationType="fade" transparent={true} visible={deleteConfirmVisible} onRequestClose={() => setDeleteConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ 確定要刪除圖片嗎？</Text>
            <Text style={styles.alertMessage}>刪除後大頭貼將恢復為預設的姓名第一個字。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setDeleteConfirmVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#E74C3C' }]} onPress={handleConfirmDeleteImage}>
                <Text style={styles.modalBtnConfirmText}>確定刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* 取消編輯確認彈窗 */}
      <Modal animationType="fade" transparent={true} visible={cancelModalVisible} onRequestClose={() => setCancelModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ 確認要取消編輯嗎？</Text>
            <Text style={styles.alertMessage}>您尚未儲存的變更內容將會遺失。</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setCancelModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.orangeAlertBtn]} onPress={handleConfirmCancel}>
                <Text style={styles.modalBtnConfirmText}>確定取消</Text>
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
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  profileCard: { backgroundColor: 'white', width: '55%', minWidth: 580, flexDirection: 'row', borderRadius: 40, padding: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  leftSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { width: 140, height: 140, marginBottom: 20, position: 'relative' },
  avatarImage: { width: 140, height: 140, borderRadius: 70 },
  avatarTextPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  avatarTextLabel: { fontSize: 44, fontWeight: 'bold', color: '#555' },
  editIconBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'white', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
  editIconText: { fontSize: 16 },
  memberName: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  placeholderText: { color: '#A9A9A9', fontWeight: 'normal', fontStyle: 'italic' },
  nameInput: { fontSize: 20, fontWeight: 'bold', color: '#333', borderBottomWidth: 1, borderColor: '#ccc', textAlign: 'center', width: '80%', paddingVertical: 2 },
  textInputRight: { fontSize: 16, color: '#333', backgroundColor: '#F9F9F9', borderRadius: 8, padding: 4, paddingHorizontal: 10, textAlign: 'right', width: '65%' },
  divider: { width: 1, backgroundColor: '#EBEBEB', marginHorizontal: 40 },
  rightSection: { flex: 1.5, justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 6 },
  infoLabel: { fontSize: 18, color: '#333', fontWeight: '600' },
  infoValue: { fontSize: 18, color: '#666' },
  readOnlyText: { color: '#777' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  customEyeButton: { marginLeft: 12, padding: 4, justifyContent: 'center', alignItems: 'center' },
  eyeShape: { position: 'relative', width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  eyeText: { fontSize: 18, color: '#999999' },
  eyeSlashLine: {
    position: 'absolute',
    width: 22,
    height: 1.5,
    backgroundColor: '#999999',
    transform: [{ rotate: '-45deg' }]
  },
  btnGroupRow: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: 15 },
  editBtn: { paddingVertical: 10, paddingHorizontal: 35, borderRadius: 15 },
  editBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  ageHighlightText: { fontSize: 18, color: '#333', marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  alertContent: { backgroundColor: '#FFF', width: 380, padding: 25, borderRadius: 20 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  alertMessage: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 25, textAlign: 'center' },
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#666', fontSize: 15, fontWeight: '500' },
  orangeAlertBtn: { backgroundColor: '#F3B07E' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  
  menuActionButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuActionTextPrimary: {
    fontSize: 16,
    color: '#E67E22',
    fontWeight: '600',
  },
  menuActionTextDanger: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '600',
  },
  menuActionTextCancel: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  }
});