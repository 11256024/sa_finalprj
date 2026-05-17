import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function DailyRecordScreen() {
  const router = useRouter();
  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('—');

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const w = parseFloat(text);
    if (!isNaN(w) && w > 0) {
      const h = 1.75; 
      const bmiCalc = (w / (h * h)).toFixed(1);
      setBmi(bmiCalc);
    } else {
      setBmi('—');
    }
  };

  // 💡【核心修正】：將「身體指數查詢」的路由精準連動到 '/body-metrics'
  const handleMenuPress = (menuName: string) => {
    if (menuName === '會員中心') {
      router.push('/profile');
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record'); 
    } else if (menuName === '歷史紀錄') {
      router.push('/history');
    } else if (menuName === '身體指數查詢') {
      router.push('/body-metrics'); // 👈 修正這裡！對應到你的 body-metrics.tsx 檔案
    } else if (menuName === '查詢商品') {
      router.push('/products');
    } else if (menuName === '成就管理') {
      router.push('/achievements');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          {/* ✨「食半功倍」純文字無法點擊 */}
          <Text style={styles.headerTitle}>食半功倍</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, item === '每日紀錄' && styles.activeMenu]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>

      {/* 主內容區 */}
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordCard}>
          <View style={styles.titleRow}>
            <Text style={styles.mainTitle}>每日紀錄</Text>
            <TouchableOpacity onPress={() => handleMenuPress('歷史紀錄')}>
              <Text style={styles.linkText}>點我看體重紀錄</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightSection}>
            <View style={styles.weightInputRow}>
              <Text style={styles.label}>今日體重</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入體重"
                value={weight}
                keyboardType="numeric"
                onChangeText={handleWeightChange}
              />
            </View>
            <View style={styles.bmiRow}>
              <Text style={styles.bmiValue}>BMI 值： {bmi}</Text>
            </View>
          </View>

          <View style={styles.mealSection}>
            <TouchableOpacity style={styles.addMealBtn}>
              <Text style={styles.addMealText}>早餐 +</Text>
            </TouchableOpacity>

            <View style={styles.tableHeader}>
              <Text style={styles.thLabel}>品項 / 單位</Text>
              <Text style={styles.thLabel}>熱量 (大卡)</Text>
            </View>

            <View style={styles.tableRow}>
              <TextInput style={styles.tableInput} placeholder="品項 / 單位" placeholderTextColor="#BBB" />
              <TextInput style={styles.tableInput} placeholder="熱量" placeholderTextColor="#BBB" keyboardType="numeric" />
            </View>
            <View style={styles.tableRow}>
              <TextInput style={styles.tableInput} placeholder="品項 / 單位" placeholderTextColor="#BBB" />
              <TextInput style={styles.tableInput} placeholder="熱量" placeholderTextColor="#BBB" keyboardType="numeric" />
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
  headerTitle: { color: 'white', fontSize: 32, fontWeight: 'bold', marginRight: 30, ...Platform.select({ web: { cursor: 'default', userSelect: 'none' } }) },
  menuWrapper: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { paddingHorizontal: 15 },
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.8 },
  activeMenu: { opacity: 1, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: 'white' },
  memberCenterBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  memberCenterText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  recordCard: { backgroundColor: 'white', width: '65%', minWidth: 650, borderRadius: 40, padding: 50, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
  mainTitle: { fontSize: 36, fontWeight: 'bold', color: '#333' },
  linkText: { fontSize: 20, color: '#F3B07E', fontWeight: '600' },
  weightSection: { marginBottom: 30 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 22, fontWeight: '600', color: '#444' },
  input: { width: '40%', fontSize: 20, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#CCC', paddingVertical: 4, color: '#333' },
  bmiRow: { alignItems: 'flex-end' },
  bmiValue: { fontSize: 20, color: '#888', fontWeight: '500' },
  mealSection: { marginTop: 10 },
  addMealBtn: { alignSelf: 'flex-start', marginBottom: 20 },
  addMealText: { fontSize: 22, color: '#4682B4', fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 5 },
  thLabel: { fontSize: 20, fontWeight: '600', color: '#555' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  tableInput: { width: '40%', fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingVertical: 4, color: '#333', textAlign: 'center' }
});