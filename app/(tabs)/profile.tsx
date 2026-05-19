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

  // 初始化個人資料狀態（預設全空）
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

  // 獲取今天日期 YYYY-MM-DD 格式
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
      // 1. 🔍 首先讀取當前嚴格登入/註冊的帳密（這是一定要同步顯示的）
      const singleAccount = await AsyncStorage.getItem('account') || await AsyncStorage.getItem('username') || '';
      const singlePassword = await AsyncStorage.getItem('password') || '';

      // 2. 讀取大禮包快取
      let localData = await AsyncStorage.getItem('userProfile') || await AsyncStorage.getItem('user_profile');
      let parsedProfile: any = {};
      if (localData) {
        try { parsedProfile = JSON.parse(localData); } catch (e) {}
      }

      // 🎯【跨帳號防呆機制】
      // 如果大禮包裡面紀錄的帳號，跟目前登入的帳號不同，或者是新註冊帳號完全沒大禮包
      // 代表這些身高體重全是「上一任登出者」或「舊測試」留下的殘留髒資料，必須切斷繼承！
      const isSameAccount = parsedProfile.account && singleAccount && (parsedProfile.account === singleAccount);

      let rawName = '';
      let rawBirthday = '';
      let rawHeight = '';
      let rawWeight = '';
      let rawGender = '';

      if (isSameAccount) {
        // 如果帳號對得上，才去信任並讀取歷史大禮包與獨立 Key
        const singleName = await AsyncStorage.getItem('user_name_key');
        const singleHeight = await AsyncStorage.getItem('user_height_key') || await AsyncStorage.getItem('height');
        const singleWeight = await AsyncStorage.getItem('user_weight_key') || await AsyncStorage.getItem('weight');

        rawName = singleName || parsedProfile.name || '';
        rawBirthday = parsedProfile.birthday || '';
        rawHeight = singleHeight || parsedProfile.height || '';
        rawWeight = singleWeight || parsedProfile.weight || '';
        rawGender = parsedProfile.gender || '';
      }

      // 3. 🚨【飲食紀錄檔權重最高】不論是否同帳號，若今天飲食紀錄有填，優先覆蓋（且飲食紀錄也要綁定今日）
      const todayKey = `food_record_${getTodayDateString()}`;
      const dailyFoodRecordRaw = await AsyncStorage.getItem(todayKey);
      if (dailyFoodRecordRaw) {
        try {
          const parsedFood = JSON.parse(dailyFoodRecordRaw);
          if (parsedFood.weight) rawWeight = parsedFood.weight.toString();
          if (parsedFood.height) rawHeight = parsedFood.height.toString();
        } catch (e) {
          console.log("解析今日飲食紀錄失敗:", e);
        }
      }

      // 4. 🧼 萬用過濾名單，徹底消滅指定測試髒資料
      const cleanName = (rawName === '王小' || rawName === '王小明' || rawName === '你好' || rawName === 'xx') ? '' : rawName;
      const cleanBirthday = (rawBirthday === '1995-01-15' || rawBirthday === '2008-11-13') ? '' : rawBirthday;
      const cleanHeight = (rawHeight === '156' || rawHeight === '102' || rawHeight === '103') ? '' : rawHeight;
      const cleanWeight = (rawWeight === '47' || rawWeight === '43' || rawWeight === '30') ? '' : rawWeight; 
      const cleanGender = (rawGender === '女' && cleanName === '') ? '' : rawGender;

      const singleAge = await AsyncStorage.getItem('age');

      const safeData = {
        name: cleanName,
        birthday: cleanBirthday,
        height: cleanHeight,
        weight: cleanWeight,
        gender: cleanGender,
        account: singleAccount, // 強制連動目前最新的登入帳號
        password: singlePassword, // 強制連動目前最新的登入密碼
        age: isSameAccount ? (singleAge || parsedProfile.age || '') : ''
      };

      setProfileData(safeData);
      setTempData(safeData);

      // 大頭貼防呆：如果換帳號了，就先用預設灰底，避免看到上個人的照片
      const savedAvatar = await AsyncStorage.getItem('user_avatar');
      if (savedAvatar && isSameAccount) {
        setAvatarUri(savedAvatar);
      } else {
        setAvatarUri(null);
      }
    } catch (error) {
      console.error("加載快取失敗：", error);
    }
  };

  // 生成下拉選單選項
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString());
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  
  const genderOptions = ['男', '女'];

  const getPureAgeValue = (birthdayStr: string): string => {
    if (!birthdayStr || birthdayStr === '1995-01-15' || birthdayStr === '2008-11-13') return '';
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      await AsyncStorage.setItem('user_avatar', result.assets[0].uri);
    }
  };

  const showWarningAlert = (message: string) => {
    if (Platform.OS === 'web') window.alert(`儲存失敗\n\n⚠️ ${message}`);
    else Alert.alert("儲存失敗", `⚠️ ${message}`);
  };

  const handleEditPress = () => {
    if (isEditing) {
      if (!tempData.name || tempData.name.trim() === '') { showWarningAlert('請輸入正確的姓名！'); return; }
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
      const calculatedAgeStr = getPureAgeValue(tempData.birthday);
      const updatedData = { ...tempData, age: calculatedAgeStr };

      setProfileData(updatedData);
      setIsEditing(false);

      const stringifiedData = JSON.stringify(updatedData);
      
      // 1. 儲存個人基本資料大禮包與獨立 Key
      await AsyncStorage.setItem('userProfile', stringifiedData);
      await AsyncStorage.setItem('user_profile', stringifiedData);
      await AsyncStorage.setItem('user_name_key', updatedData.name.trim());
      await AsyncStorage.setItem('user_height_key', updatedData.height);
      await AsyncStorage.setItem('height', updatedData.height);
      await AsyncStorage.setItem('user_weight_key', updatedData.weight);
      await AsyncStorage.setItem('weight', updatedData.weight);
      if (updatedData.age) {
        await AsyncStorage.setItem('age', updatedData.age);
      }

      // 2. 即時回填並同步至飲食紀錄檔
      const todayKey = `food_record_${getTodayDateString()}`;
      const dailyFoodRecordRaw = await AsyncStorage.getItem(todayKey);
      
      let parsedFood: any = { mealBlocks: { 早餐: [], 午餐: [], 晚餐: [] } };
      if (dailyFoodRecordRaw) {
        try { parsedFood = JSON.parse(dailyFoodRecordRaw); } catch (e) {}
      }

      parsedFood.weight = updatedData.weight;
      parsedFood.height = updatedData.height; 

      // BMI 計算
      const hMeter = parseFloat(updatedData.height) / 100;
      const wKg = parseFloat(updatedData.weight);
      if (hMeter > 0 && wKg > 0) {
        parsedFood.bmi = (wKg / (hMeter * hMeter)).toFixed(1);
        if (parsedFood.bmi < 18.5) parsedFood.bmiStatus = "體重過輕";
        else if (parsedFood.bmi >= 18.5 && parsedFood.bmi < 24) parsedFood.bmiStatus = "正常範圍";
        else parsedFood.bmiStatus = "肥胖";
      }

      await AsyncStorage.setItem(todayKey, JSON.stringify(parsedFood));

      if (Platform.OS === 'web') window.alert("個人資料已成功更新！");
      else Alert.alert("成功", "個人資料已成功更新！");
    } catch (error) {
      console.error(error);
    }
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
    outline: 'none'
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          
          {/* 左側欄位（大頭貼與姓名） */}
          <View style={styles.leftSection}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder} />
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
                  <input
                    type="date"
                    value={tempData.birthday}
                    max={getTodayDateString()} 
                    onChange={(e) => setTempData({ ...tempData, birthday: e.target.value })}
                    style={webSelectStyle}
                  />
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
                <Text style={[styles.infoValue, (!profileData.birthday || profileData.birthday === '') && styles.placeholderText]}>
                  {!profileData.birthday || profileData.birthday === '' ? (
                    '請選擇生日'
                  ) : (
                    <>
                      {profileData.birthday}
                      <Text style={styles.ageHighlightText}>{renderAgeLabel(profileData.birthday)}</Text>
                    </>
                  )}
                </Text>
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
                    <option value="">請選擇體重(四捨五入到整數位)</option>
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

            {/* 🔒 帳號 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>帳 號</Text>
              <Text style={[styles.infoValue, styles.readOnlyText, (!profileData.account || profileData.account.trim() === '') && styles.placeholderText]}>
                {profileData.account && profileData.account.trim() !== '' ? profileData.account : '請輸入帳號'}
              </Text>
            </View>

            {/* 🔒 密碼 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>密 碼</Text>
              <Text style={[styles.infoValue, styles.readOnlyText, (!profileData.password || profileData.password.trim() === '') && styles.placeholderText]}>
                {profileData.password && profileData.password.trim() !== '' ? '••••••••' : '請輸入密碼'}
              </Text>
            </View>

            {/* 按鈕組 */}
            <View style={styles.btnGroupRow}>
              {isEditing ? (
                <>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#ccc', marginRight: 15 }]} onPress={() => setIsEditing(false)}>
                    <Text style={styles.editBtnText}>取 消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#F3B07E' }]} onPress={handleEditPress}>
                    <Text style={styles.editBtnText}>儲 存</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#E67E22' }]} onPress={handleEditPress}>
                  <Text style={styles.editBtnText}>編 輯</Text>
                </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0E7DA' },
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  profileCard: { backgroundColor: 'white', width: '55%', minWidth: 580, flexDirection: 'row', borderRadius: 40, padding: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  leftSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { width: 140, height: 140, marginBottom: 20, position: 'relative' },
  avatarPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E0E0E0' },
  avatarImage: { width: 140, height: 140, borderRadius: 70 },
  editIconBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'white', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  editIconText: { fontSize: 16 },
  memberName: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  placeholderText: { color: '#A9A9A9', fontWeight: 'normal', fontStyle: 'italic' },
  nameInput: { fontSize: 20, fontWeight: 'bold', color: '#333', borderBottomWidth: 1, borderColor: '#ccc', textAlign: 'center', width: '80%', paddingVertical: 2 },
  textInputRight: { fontSize: 16, color: '#333', backgroundColor: '#F9F9F9', borderRadius: 8, padding: '4px 10px', textAlign: 'right', width: '65%' },
  divider: { width: 1, backgroundColor: '#EBEBEB', marginHorizontal: 40 },
  rightSection: { flex: 1.5, justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#F2F2F2', paddingBottom: 6 },
  infoLabel: { fontSize: 18, color: '#333', fontWeight: '600' },
  infoValue: { fontSize: 18, color: '#666' },
  readOnlyText: { color: '#777' },
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
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});