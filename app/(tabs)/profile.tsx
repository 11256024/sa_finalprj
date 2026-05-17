import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  // 1. 控制目前是「瀏覽狀態」還是「編輯狀態」
  const [isEditing, setIsEditing] = useState(false);

  // 2. 個人資訊的狀態管理
  const [profileData, setProfileData] = useState({
    name: '王小明',
    birthday: '1995-08-15',
    height: '175',
    weight: '70',
    gender: '男',
    account: 'xiaoming123',
    password: 'Password123!',
  });

  // 暫存編輯中的數據
  const [tempData, setTempData] = useState({ ...profileData });

  // 3. 大頭貼圖片狀態
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // 選單選值範圍設定
  const heightOptions = Array.from({ length: 151 }, (_, i) => (i + 100).toString()); // 100~250
  const weightOptions = Array.from({ length: 171 }, (_, i) => (i + 30).toString());  // 30~200
  const genderOptions = ['男', '女'];

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

  // 處理點擊「儲存」按鈕
  const handleEditPress = () => {
    if (isEditing) {
      setProfileData({ ...tempData });
      setIsEditing(false);
      if (Platform.OS === 'web') {
        window.alert("個人資料已成功更新！");
      } else {
        Alert.alert("成功", "個人資料已成功更新！");
      }
    } else {
      setTempData({ ...profileData });
      setIsEditing(true);
    }
  };

  // 取消警示框
  const handleCancelPress = () => {
    const message = "確定要取消嗎？未儲存的變更將會遺失。";
    
    if (Platform.OS === 'web') {
      const confirmCancel = window.confirm(message);
      if (confirmCancel) {
        setIsEditing(false);
      }
    } else {
      Alert.alert(
        "取消編輯",
        message,
        [
          { text: "再想想", style: "cancel" },
          { text: "確定", onPress: () => setIsEditing(false) }
        ]
      );
    }
  };

  // 💡【已連動路由】：點擊導覽列各個項目時跳轉到對應檔案
  const handleMenuPress = (menuName: string) => {
    if (menuName === '身體指數查詢') {
      router.push('/body-metrics'); // 👈 連接到身體指數查詢檔案
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');  // 👈 連接到每日紀錄檔案
    } else if (menuName === '會員中心') {
      router.push('/profile');       // 會員中心留在此頁
    } else {
      if (Platform.OS === 'web') window.alert(`即將前往：${menuName}`);
      else Alert.alert("導航", `即將前往：${menuName}`);
    }
  };

  // 網頁版下拉選單通用樣式
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
          {/* ✨【關鍵修正】：保持純文字，全站皆無法點擊 */}
          <Text style={styles.headerTitle}>食半功倍</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, styles.nonClickableText]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 右側會員中心按鈕（保持高亮狀態） */}
        <TouchableOpacity style={styles.memberCenterBtnActive} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          
          {/* 左側：大頭貼與姓名 */}
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

          {/* 右側：詳細資料區 */}
          <View style={styles.rightSection}>
            
            {/* 生日選單 */}
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
                <Text style={styles.infoValue}>{profileData.birthday}</Text>
              )}
            </View>

            {/* 身高選單 */}
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

            {/* 體重選單 */}
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

            {/* 生理性別選單 */}
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

            {/* 帳號 */}
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

            {/* 密碼 */}
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

            {/* 按鈕組 */}
            <View style={styles.btnGroupRow}>
              {isEditing && (
                <TouchableOpacity 
                  style={[styles.editBtn, { backgroundColor: '#ccc', marginRight: 15 }]} 
                  onPress={handleCancelPress}
                >
                  <Text style={styles.editBtnText}>取 消</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.editBtn} onPress={handleEditPress}>
                <Text style={styles.editBtnText}>{isEditing ? '儲 存' : '編 輯'}</Text>
              </TouchableOpacity>
            </View>

          </View>
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
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8 },
  nonClickableText: { ...Platform.select({ web: { userSelect: 'none' } }) },
  
  memberCenterBtnActive: { backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'white' },
  memberCenterText: { color: '#A3C1AD', fontSize: 16, fontWeight: 'bold' },
  
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
  editBtn: { backgroundColor: '#F3B07E', paddingVertical: 10, paddingHorizontal: 35, borderRadius: 15 },
  editBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});