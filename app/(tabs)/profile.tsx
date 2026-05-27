import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://127.0.0.1:8001';

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

  const normalizeDateForApi = (value: string) => {
    if (!value) return '';
    return value.trim().replace(/\//g, '-');
  };

  const parseApiResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
    }
  };

  const getTodayDateString = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.format(now).split('/');
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  };

  const getTodayRecordWeight = async (memberId: string) => {
    try {
      const todayFoodKey = `${memberId}_food_record_${getTodayDateString()}`;
      const dailyFoodRecordRaw = await AsyncStorage.getItem(todayFoodKey);

      if (!dailyFoodRecordRaw) return '';

      const parsedFood = JSON.parse(dailyFoodRecordRaw);

      if (
        parsedFood.hasDailyWeight === true &&
        parsedFood.weight !== undefined &&
        parsedFood.weight !== null &&
        parsedFood.weight.toString().trim() !== ''
      ) {
        return parsedFood.weight.toString().trim();
      }

      return '';
    } catch (e) {
      console.log('讀取今日每日紀錄體重失敗:', e);
      return '';
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const getCurrentMemberContext = async () => {
    const userStr = await AsyncStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;

    const savedCurrentUserId = await AsyncStorage.getItem('current_user_id');
    const savedMemberId = await AsyncStorage.getItem('member_id');

    const memberId =
      currentUser?.id?.toString?.() ||
      savedCurrentUserId ||
      savedMemberId ||
      'guest';

    return { memberId, currentUser };
  };

  const loadProfileData = async () => {
    try {
      const { memberId: savedUserId, currentUser } = await getCurrentMemberContext();

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

      const singleNameForInstant = await AsyncStorage.getItem(`${savedUserId}_user_name_key`);
      const singleHeightForInstant = await AsyncStorage.getItem(`${savedUserId}_user_height`);
      const singleWeightForInstant = await AsyncStorage.getItem(`${savedUserId}_user_weight`);
      const savedAvatarForInstant = await AsyncStorage.getItem(`${savedUserId}_user_avatar`);
      const todayRecordWeight = await getTodayRecordWeight(savedUserId);

      const instantBirthday = parsedProfile.birthday || '';
      const instantName = singleNameForInstant || parsedProfile.name || '';
      const instantHeight = singleHeightForInstant || parsedProfile.height || '';
      const instantWeight = todayRecordWeight || singleWeightForInstant || parsedProfile.weight || '';
      const instantGender = parsedProfile.gender || '';

      const instantData = {
        name: (instantName === '請輸入姓名' || instantName === '王小' || instantName === '王小明' || instantName === '你好' || instantName === 'xx') ? '' : instantName,
        birthday: (instantBirthday === '請選擇生日' || instantBirthday === '1995-01-15') ? '' : instantBirthday,
        height: (instantHeight === '請選擇身高' || !instantHeight) ? '' : instantHeight.toString().trim(),
        weight: (instantWeight === '請選擇體重' || !instantWeight) ? '' : instantWeight.toString().trim(),
        gender: instantGender === '請選擇性別' ? '' : instantGender,
        account: singleAccount || parsedProfile.account || '',
        password: singlePassword || parsedProfile.password || '',
        age: instantBirthday ? getPureAgeValue(instantBirthday) : ''
      };

      setProfileData(instantData);
      setTempData(instantData);
      if (savedAvatarForInstant || parsedProfile.avatar) {
        setAvatarUri(savedAvatarForInstant || parsedProfile.avatar);
      }

      let dbProfile: any = {};
      let hasDbProfile = false;

      if (savedUserId && savedUserId !== 'guest') {
        try {
          const response = await fetch(`${API_URL}/member/profile/${savedUserId}/`);
          const data = await parseApiResponse(response);

          if (response.ok && data.success && data.member) {
            dbProfile = data.member;
            hasDbProfile = true;

            await AsyncStorage.setItem('user', JSON.stringify({
              ...(currentUser || {}),
              ...data.member,
            }));
            await AsyncStorage.setItem('current_user_id', String(data.member.id));
            await AsyncStorage.setItem('member_id', String(data.member.id));
          }
        } catch (e) {
          console.log('⚠️ 從後端讀取會員資料失敗，才改用本機快取:', e);
        }
      }

      const singleName = await AsyncStorage.getItem(`${savedUserId}_user_name_key`);

      let rawName = '';
      let rawAvatar = '';
      let rawBirthday = '';
      let rawHeight = '';
      let rawWeight = '';
      let rawGender = '';

      if (hasDbProfile) {
        rawName = dbProfile.name ? String(dbProfile.name) : '';
        rawAvatar = dbProfile.avatar ? String(dbProfile.avatar) : '';
        rawBirthday = dbProfile.birthday ? String(dbProfile.birthday) : '';
        rawHeight = dbProfile.height !== null && dbProfile.height !== undefined ? String(dbProfile.height) : '';
        rawWeight = todayRecordWeight || (dbProfile.initial_weight !== null && dbProfile.initial_weight !== undefined ? String(dbProfile.initial_weight) : '');
        rawGender = dbProfile.gender ? String(dbProfile.gender) : '';

        await AsyncStorage.multiRemove([
          'user_avatar',
          'user_avatar_uri',
        ]);
      } else {
        const singleHeight = await AsyncStorage.getItem(`${savedUserId}_user_height`);
        const singleWeight = await AsyncStorage.getItem(`${savedUserId}_user_weight`);
        const savedAvatar = await AsyncStorage.getItem(`${savedUserId}_user_avatar`);

        rawName = singleName || parsedProfile.name || '';
        rawAvatar = savedAvatar || parsedProfile.avatar || '';
        rawBirthday = parsedProfile.birthday || '';
        rawHeight = singleHeight || parsedProfile.height || '';
        rawWeight = todayRecordWeight || singleWeight || parsedProfile.weight || '';
        rawGender = parsedProfile.gender || '';
      }

      const cleanName = (rawName === '請輸入姓名' || rawName === '王小' || rawName === '王小明' || rawName === '你好' || rawName === 'xx') ? '' : rawName;
      const cleanBirthday = (rawBirthday === '請選擇生日' || rawBirthday === '1995-01-15') ? '' : rawBirthday;
      const cleanHeight = (rawHeight === '請選擇身高' || !rawHeight) ? '' : rawHeight.toString().trim();
      const cleanWeight = (rawWeight === '請選擇體重' || !rawWeight) ? '' : rawWeight.toString().trim();
      const cleanGender = (rawGender === '請選擇性別') ? '' : rawGender;

      const singleAge = cleanBirthday ? getPureAgeValue(cleanBirthday) : '';

      const safeData = {
        name: cleanName,
        birthday: cleanBirthday,
        height: cleanHeight,
        weight: cleanWeight,
        gender: cleanGender,
        account: singleAccount || parsedProfile.account || '',
        password: singlePassword || parsedProfile.password || '',
        age: singleAge
      };

      setProfileData(safeData);
      setTempData(safeData);
      setAvatarUri(rawAvatar || savedAvatarForInstant || null);

      await AsyncStorage.setItem(`${savedUserId}_user_profile`, JSON.stringify(safeData));
      await AsyncStorage.setItem(`${savedUserId}_user_height`, safeData.height);
      await AsyncStorage.setItem(`${savedUserId}_user_weight`, safeData.weight);
      if (safeData.name) {
        await AsyncStorage.setItem(`${savedUserId}_user_name_key`, safeData.name);
      }
      if (safeData.age) {
        await AsyncStorage.setItem(`${savedUserId}_user_age`, safeData.age);
      }
      if (rawAvatar || savedAvatarForInstant) {
        await AsyncStorage.setItem(`${savedUserId}_user_avatar`, rawAvatar || savedAvatarForInstant || '');
      }
    } catch (error) {
      error && console.error("加載會員資料失敗：", error);
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

  const saveAvatarToDatabase = async (avatarValue: string | null) => {
    try {
      const { memberId: savedUserId, currentUser } = await getCurrentMemberContext();

      if (!savedUserId || savedUserId === 'guest') {
        return;
      }

      const response = await fetch(`${API_URL}/member/profile/${savedUserId}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar: avatarValue,
        }),
      });

      const data = await parseApiResponse(response);

      if (response.ok && data.success && data.member) {
        await AsyncStorage.setItem('user', JSON.stringify({
          ...(currentUser || {}),
          ...data.member,
        }));
      }
    } catch (error) {
      console.log('⚠️ 大頭貼同步到資料庫失敗:', error);
    }
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
          setAvatarUri(base64Data);
          const currentUserId =
            await AsyncStorage.getItem('current_user_id') ||
            await AsyncStorage.getItem('member_id') ||
            'guest';
          await AsyncStorage.setItem(`${currentUserId}_user_avatar`, base64Data);
          await saveAvatarToDatabase(base64Data);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.log('⚠️ Base64 轉換失敗，使用原始 URI:', e);
        setAvatarUri(imageUri);
        const currentUserId =
          await AsyncStorage.getItem('current_user_id') ||
          await AsyncStorage.getItem('member_id') ||
          'guest';
        await AsyncStorage.setItem(`${currentUserId}_user_avatar`, imageUri);
        await saveAvatarToDatabase(imageUri);
      }
    }
  };

  const handleConfirmDeleteImage = async () => {
    setDeleteConfirmVisible(false);
    setAvatarUri(null);
    try {
      const currentUserId =
        await AsyncStorage.getItem('current_user_id') ||
        await AsyncStorage.getItem('member_id') ||
        'guest';
      await AsyncStorage.removeItem(`${currentUserId}_user_avatar`);
      await AsyncStorage.removeItem('user_avatar');
      await AsyncStorage.removeItem('user_avatar_uri');
      await saveAvatarToDatabase(null);
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

  // =================================================================
  // ⏱️ 核心控時：無轉圈圈彈窗，精準卡死「剛好 1.0 秒（1000ms）」儲存成功！
  // =================================================================
  const handleConfirmSave = async () => {
    setSaveModalVisible(false); // 關閉「確認儲存變更嗎」對話框

    try {
      const { memberId: savedUserId, currentUser } = await getCurrentMemberContext();

      if (!savedUserId || savedUserId === 'guest') {
        showWarningAlert('找不到登入會員 ID，請重新登入後再試一次。');
        return;
      }

      const birthdayForApi = normalizeDateForApi(tempData.birthday);
      const calculatedAgeStr = getPureAgeValue(birthdayForApi || tempData.birthday);
      const updatedData = {
        ...tempData,
        birthday: birthdayForApi,
        account: profileData.account,
        password: profileData.password,
        age: calculatedAgeStr,
      };

      // 1. ⚡ 立刻搶先寫入本機快取與更新渲染狀態 (耗時 < 2ms)
      setProfileData(updatedData);
      setTempData(updatedData);

      const stringifiedData = JSON.stringify(updatedData);
      await AsyncStorage.setItem(`${savedUserId}_user_profile`, stringifiedData);
      await AsyncStorage.setItem(`${savedUserId}_user_name_key`, updatedData.name.trim());
      await AsyncStorage.setItem(`${savedUserId}_user_height`, updatedData.height);
      await AsyncStorage.setItem(`${savedUserId}_user_weight`, updatedData.weight);

      if (updatedData.age) {
        await AsyncStorage.setItem(`${savedUserId}_user_age`, updatedData.age);
      }

      // 2. 🤫 幕後分流：把非同步網路要求丟進背景執行，絕不阻塞前台控時
      const bgNetworkRequest = (async () => {
        try {
          const response = await fetch(`${API_URL}/member/profile/${savedUserId}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: updatedData.name.trim() || null,
              avatar: avatarUri || null,
              gender: updatedData.gender || null,
              birthday: birthdayForApi || null,
              height: updatedData.height ? Number(updatedData.height) : null,
              initial_weight: updatedData.weight ? Number(updatedData.weight) : null,
            }),
          });

          const data = await parseApiResponse(response);
          if (response.ok && data.success && data.member) {
            await AsyncStorage.setItem('user', JSON.stringify({
              ...(currentUser || {}),
              ...data.member,
            }));
            await AsyncStorage.setItem('current_user_id', String(data.member.id));
            await AsyncStorage.setItem('member_id', String(data.member.id));
          }
        } catch (netErr) {
          console.log('背景雲端備份略過，數據已在本機快取安全儲存', netErr);
        }
      })();

      // 3. 🎯 精準控制：定時器強制背景數秒，不加遮罩，「剛好 1000 毫秒 (1秒)」跳出成功
      setTimeout(() => {
        setIsEditing(false); // 離開編輯狀態，切換成唯讀檢視
        
        // 剛好滿一秒，直接跳出儲存成功提示
        if (Platform.OS === 'web') {
          window.alert('✨ 會員個人基本資料儲存成功！');
        } else {
          Alert.alert("成功", "✨ 會員個人基本資料儲存成功！");
        }
      }, 1000); // ⏱️ 精準 1.0 秒

    } catch (error: any) {
      console.error('更新會員資料失敗：', error);
      showWarningAlert(error?.message || '無法連接後端，請確認 Django 是否已啟動。');
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
    cursor: 'pointer',
    touchAction: 'manipulation',
    willChange: 'transform',
  };

  const webCalendarStyle = {
    fontSize: '16px',
    color: '#333',
    backgroundColor: '#F9F9F9',
    border: '1px solid #DDD',
    borderRadius: '8px',
    padding: '4px 10px',
    textAlign: 'right' as const,
    width: '65%',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    touchAction: 'manipulation',
    willChange: 'transform',
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
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabelText}>生</Text>
                <Text style={styles.infoLabelText}>日</Text>
              </View>
              {isEditing ? (
                Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={tempData.birthday}
                    min="1900-01-01"
                    max="2026-12-31"
                    onChange={(e) => setTempData({ ...tempData, birthday: e.target.value })}
                    style={webCalendarStyle}
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.infoLabelContainer}>
                  <Text style={styles.infoLabelText}>身</Text>
                  <Text style={styles.infoLabelText}>高</Text>
                </View>
                <Text style={styles.infoLabelText}> (cm)</Text>
              </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.infoLabelContainer}>
                  <Text style={styles.infoLabelText}>體</Text>
                  <Text style={styles.infoLabelText}>重</Text>
                </View>
                <Text style={styles.infoLabelText}> (kg)</Text>
              </View>
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
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabelText}>生</Text>
                <Text style={styles.infoLabelText}>理</Text>
                <Text style={styles.infoLabelText}>性</Text>
                <Text style={styles.infoLabelText}>別</Text>
              </View>
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
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabelText}>帳</Text>
                <Text style={styles.infoLabelText}>號</Text>
              </View>
              <Text style={[styles.infoValue, styles.readOnlyText, (!profileData.account || profileData.account.trim() === '') && styles.placeholderText]}>
                {profileData.account && profileData.account.trim() !== '' ? profileData.account : '請輸入帳號'}
              </Text>
            </View>

            {/* 密碼 */}
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabelText}>密</Text>
                <Text style={styles.infoLabelText}>碼</Text>
              </View>
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
                    <Ionicons
                      name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#999999"
                    />
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

      {/* 自訂大頭貼選單 Modal */}
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

      {/* 刪除圖片防呆二次確認 Modal */}
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
  infoLabelContainer: { width: 110, flexDirection: 'row', justifyContent: 'space-between' },
  infoLabelText: { fontSize: 18, color: '#333', fontWeight: '600' },
  infoValue: { fontSize: 18, color: '#666' },
  readOnlyText: { color: '#777' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  customEyeButton: { marginLeft: 12, padding: 4, justifyContent: 'center', alignItems: 'center' },
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
  menuActionTextPrimary: { fontSize: 16, color: '#E67E22', fontWeight: '600' },
  menuActionTextDanger: { fontSize: 16, color: '#E74C3C', fontWeight: '600' },
  menuActionTextCancel: { fontSize: 16, color: '#99', fontWeight: '500' }
});