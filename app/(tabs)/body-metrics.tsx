import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BodyMetricsScreen() {
  const router = useRouter();

  const handleMenuPress = (menuName: string) => {
    if (menuName === '身體指數查詢') {
      router.push('/body-metrics');
    } else if (menuName === '會員中心') {
      router.push('/profile'); // 💡 點擊會員中心跳回個人資料檔
    } else if (menuName === '每日紀錄') {
      router.push('/daily-record');
    } else {
      if (Platform.OS === 'web') window.alert(`即將前往：${menuName}`);
      else Alert.alert("導航", `即將前往：${menuName}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          {/* 💡 已改成純 Text，全站皆不可點擊 */}
          <Text style={styles.headerTitle}>食半功倍</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuWrapper}>
            {['每日紀錄', '歷史紀錄', '身體指數查詢', '查詢商品', '成就管理'].map((item) => (
              <TouchableOpacity key={item} onPress={() => handleMenuPress(item)} style={styles.menuButton}>
                <Text style={[styles.headerMenu, item === '身體指數查詢' && styles.activeMenu]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.memberCenterBtn} onPress={() => handleMenuPress('會員中心')}>
          <Text style={styles.memberCenterText}>會員中心</Text>
        </TouchableOpacity>
      </View>

      {/* 身體指數主內容區 */}
      <View style={styles.content}>
        <View style={styles.metricsCard}>
          
          {/* 左側：BMR 卡片 */}
          <View style={styles.bmrCard}>
            <Text style={styles.bmrMainTitle}>基礎代謝率 BMR</Text>
            <View style={styles.bmrList}>
              {['生理性別', '年 齡', '身 高', '體 重', 'B M I'].map((label) => (
                <View key={label} style={styles.bmrRow}>
                  <Text style={styles.bmrLabel}>{label}</Text>
                  <Text style={styles.bmrValue}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>計算結果：</Text>
              <Text style={styles.resultValue}>BMR</Text>
            </View>
          </View>

          {/* 右側：TDEE 卡片組 */}
          <View style={styles.tdeeSection}>
            <View style={styles.tdeeMainHeader}>
              <Text style={styles.tdeeTitle}>TDEE</Text>
              <Text style={styles.tdeeSubTitle}>每日總消耗</Text>
            </View>
            <Text style={styles.tdeeDesc}>人體一整天下來消耗的總熱量</Text>

            {/* TDEE 項目 1 */}
            <View style={styles.tdeeItemBox}>
              <Text style={styles.activityTitle}>身體活動趨於靜態</Text>
              <Text style={styles.activitySub}>(幾乎不運動)</Text>
              <Text style={styles.formulaText}>BMR x 1.2 = <Text style={styles.orangeHighlight}>1717.2</Text></Text>
            </View>

            {/* TDEE 項目 2 */}
            <View style={styles.tdeeItemBox}>
              <Text style={styles.activityTitle}>身體活動趨於靜態</Text>
              <Text style={styles.activitySub}>(幾乎不運動)</Text>
              <Text style={styles.formulaText}>BMR x 1.2 = <Text style={styles.orangeHighlight}>1717.2</Text></Text>
            </View>
          </View>

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
  headerMenu: { color: 'white', fontSize: 18, fontWeight: '500', opacity: 0.7 },
  activeMenu: { opacity: 1, fontWeight: 'bold' },
  memberCenterBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  memberCenterText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', padding: 20 },
  metricsCard: { width: '70%', minWidth: 850, flexDirection: 'row', justifyContent: 'space-between' },
  
  bmrCard: { backgroundColor: 'white', flex: 1.1, borderRadius: 40, padding: 45, marginRight: 25, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  bmrMainTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 30 },
  bmrList: { marginBottom: 30 },
  bmrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  bmrLabel: { fontSize: 18, fontWeight: '600', color: '#444' },
  bmrValue: { fontSize: 18, color: '#BBB' },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  resultLabel: { fontSize: 22, color: '#F3B07E', fontWeight: 'bold' },
  resultValue: { fontSize: 28, color: '#BBB', fontWeight: 'bold', marginLeft: 10 },

  tdeeSection: { flex: 1, marginLeft: 25 },
  tdeeMainHeader: { flexDirection: 'row', alignItems: 'baseline' },
  tdeeTitle: { fontSize: 36, fontWeight: 'bold', color: '#333', marginRight: 8 },
  tdeeSubTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  tdeeDesc: { fontSize: 15, color: '#F3B07E', marginTop: 4, marginBottom: 20 },
  tdeeItemBox: { backgroundColor: 'white', borderRadius: 25, padding: 25, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  activityTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  activitySub: { fontSize: 16, color: '#BBB', marginTop: 2, marginBottom: 10 },
  formulaText: { fontSize: 20, color: '#333' },
  orangeHighlight: { color: '#F3B07E', fontWeight: 'bold' }
});