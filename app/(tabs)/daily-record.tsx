// 檔案說明：每日紀錄頁面：記錄今日體重、三餐飲食與熱量，並同步到本機快取及後端。
// 說明：下方 import 會把此頁需要的 React、React Native、路由、圖示與資料工具載入。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDataContext } from '../../context/DataContext';

// 說明：後端 API 的本機網址，fetch 會以這個位址呼叫 Django 服務。
const API_URL = 'http://127.0.0.1:8000';

// 說明：統一解析後端回應，避免後端不是 JSON 時讓錯誤訊息太難懂。
const parseApiResponse = async (response: Response) => {
  // 說明：宣告 text，集中處理這段畫面邏輯會用到的資料或方法。
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`後端回傳不是 JSON，HTTP ${response.status}：${text.slice(0, 180)}`);
  }
};

// 說明：讀取目前登入者 ID，之後用來組 AsyncStorage key 或呼叫會員 API。
const getCurrentMemberId = async () => {
  try {
    // 說明：宣告 userStr，集中處理這段畫面邏輯會用到的資料或方法。
    const userStr = await AsyncStorage.getItem('user');
    // 說明：宣告 currentUser，集中處理這段畫面邏輯會用到的資料或方法。
    const currentUser = userStr ? JSON.parse(userStr) : null;

    // 說明：宣告 memberId，集中處理這段畫面邏輯會用到的資料或方法。
    const memberId =
      currentUser?.id?.toString?.() ||
      (await AsyncStorage.getItem('current_user_id')) ||
      (await AsyncStorage.getItem('member_id')) ||
      'guest';

    return /^\d+$/.test(memberId) ? memberId : 'guest';
  } catch {
    return 'guest';
  }
};

// 說明：把後端回傳欄位轉成前端畫面固定使用的資料格式。
const mapProductFromApi = (item: any): Product => {
  return {
    id: String(item.id),
    name: String(item.name || ''),
    unit: String(item.unit || ''),
    calories: Number(item.calories || 0),
    status: item.status || 'approved',
    creatorId:
      item.creator_id !== undefined && item.creator_id !== null
        ? String(item.creator_id)
        : item.creator
        ? String(item.creator)
        : undefined,
  };
};

// 說明：FoodItem 定義這個頁面會使用的資料欄位與型別。
interface FoodItem {
  id: string;
  name: string;      
  calories: string;  
  singleCalories?: string; 
  servings?: number;       
}

// 說明：Product 定義這個頁面會使用的資料欄位與型別。
interface Product {
  id: string;
  name: string;
  unit: string;
  calories: number;
  status: 'approved' | 'pending' | 'rejected';
  creatorId?: string;
}

// 說明：DailyRecordScreen 是此檔案的主要畫面元件，負責組合狀態、資料處理與 UI。
export default function DailyRecordScreen() {
  // 說明：宣告 router，集中處理這段畫面邏輯會用到的資料或方法。
  const router = useRouter();
  // 說明：宣告 pathname，集中處理這段畫面邏輯會用到的資料或方法。
  const pathname = usePathname(); 
  const { updateDailyRecord, updateWeight, weightUpdateVersion, lastWeightValue } = useDataContext();

  const [userId, setUserId] = useState<string>('guest'); 

  // 說明：宣告 getTaiwanDateString，集中處理這段畫面邏輯會用到的資料或方法。
  const getTaiwanDateString = () => {
    // 說明：宣告 now，集中處理這段畫面邏輯會用到的資料或方法。
    const now = new Date();
    // 說明：整理顯示文字，讓資料在畫面上比較乾淨易讀。
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // 說明：宣告 parts，集中處理這段畫面邏輯會用到的資料或方法。
    const parts = formatter.format(now).split('/');
    return `${parts[0]}-${parts[1]}-${parts[2]}`;
  };

  const [currentDate, setCurrentDate] = useState<string>(getTaiwanDateString());
  const [weight, setWeight] = useState('');
  const [bmi, setBmi] = useState('—');
  const [bmiStatus, setBmiStatus] = useState(''); 
  const [userHeight, setUserHeight] = useState<number | null>(null); 

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  const [currentBlockCategory, setCurrentBlockCategory] = useState<'早餐' | '午餐' | '晚餐'>('早餐');
  
  const [inputItemName, setInputItemName] = useState('');
  const [inputUnitValue, setInputUnitValue] = useState(''); 
  const [selectedUnitType, setSelectedUnitType] = useState<'克' | 'ml'>('克'); 
  const [inputCalories, setInputCalories] = useState(''); 
  const [servings, setServings] = useState<number>(1);   
  const [isServingsDropdownOpen, setIsServingsDropdownOpen] = useState(false); 

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSuggestionDropdownOpen, setIsSuggestionDropdownOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [mealBlocks, setMealBlocks] = useState<{
    早餐: FoodItem[];
    午餐: FoodItem[];
    晚餐: FoodItem[];
  }>({
    早餐: [], 
    午餐: [], 
    晚餐: [], 
  });

  // 說明：保存 stateRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const stateRef = useRef({ weight, bmi, bmiStatus, mealBlocks, currentDate, userId });
  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    stateRef.current = { weight, bmi, bmiStatus, mealBlocks, currentDate, userId };
  }, [weight, bmi, bmiStatus, mealBlocks, currentDate, userId]);

  // 說明：保存 weightSyncTimerRef 的可變參考值，用來跨 render 保留元件、計時器或最新資料。
  const weightSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
    const initUserAndLoad = async () => {
      try {
        // 說明：宣告 finalId，集中處理這段畫面邏輯會用到的資料或方法。
        const finalId = await getCurrentMemberId();
        setUserId(finalId);
        
        // 說明：宣告 todayStr，集中處理這段畫面邏輯會用到的資料或方法。
        const todayStr = getTaiwanDateString();
        setCurrentDate(todayStr);

        // 說明：宣告 cachedHeight，集中處理這段畫面邏輯會用到的資料或方法。
        const cachedHeight = await loadCachedMemberHeight(finalId);
        await loadDataByDate(todayStr, finalId, cachedHeight);

        // 說明：宣告 memberHeight，集中處理這段畫面邏輯會用到的資料或方法。
        const memberHeight = await loadMemberHeight(finalId);
        if (memberHeight !== cachedHeight) {
          await loadDataByDate(todayStr, finalId, memberHeight);
        }
      } catch (e) {
        console.error('初始化失敗', e);
        // 說明：宣告 todayStr，集中處理這段畫面邏輯會用到的資料或方法。
        const todayStr = getTaiwanDateString();
        await loadDataByDate(todayStr, 'guest');
      }
    };
    initUserAndLoad();
  }, [pathname]);

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    if (lastWeightValue && lastWeightValue !== weight) {
      setWeight(lastWeightValue);
      const { calculatedBmi, calculatedStatus } = calculateBmiByHeight(lastWeightValue, userHeight);
      setBmi(calculatedBmi);
      setBmiStatus(calculatedStatus);
      
      stateRef.current.weight = lastWeightValue;
      stateRef.current.bmi = calculatedBmi;
      stateRef.current.bmiStatus = calculatedStatus;
    }
  }, [weightUpdateVersion]);

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const loadApprovedProducts = async () => {
    try {
      setIsLoadingProducts(true);
      // 說明：宣告 resp，集中處理這段畫面邏輯會用到的資料或方法。
      const resp = await fetch(`${API_URL}/products/`);
      if (!resp.ok) return;
      // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
      const data = await resp.json();
      if (!Array.isArray(data)) return;
      // 說明：宣告 mappedProducts，集中處理這段畫面邏輯會用到的資料或方法。
      const mappedProducts = data.map(mapProductFromApi).filter((item) => item.status === 'approved');
      setAllProducts(mappedProducts);
    } catch (error) {
      console.error('載入商品建議失敗', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    loadApprovedProducts();
  }, []);

  // 說明：這個 effect 會在畫面載入、聚焦或相依資料改變時執行同步邏輯。
  useEffect(() => {
    if (inputItemName.trim() !== '' && allProducts && allProducts.length > 0) {
      filterProductSuggestions(inputItemName);
    }
  }, [allProducts]);

  // 說明：依照關鍵字或頁籤條件篩選要顯示的資料。
  const filterProductSuggestions = (keyword: string) => {
    // 說明：宣告 trimmed，集中處理這段畫面邏輯會用到的資料或方法。
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed || !allProducts) {
      setProductSuggestions([]);
      return;
    }
    setProductSuggestions(
      allProducts
        .filter((product) => product.name.toLowerCase().includes(trimmed))
        .slice(0, 6),
    );
  };

  // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
  const parseProductUnit = (unit: string) => {
    // 說明：宣告 normalized，集中處理這段畫面邏輯會用到的資料或方法。
    const normalized = String(unit || '').trim();
    // 說明：宣告 match，集中處理這段畫面邏輯會用到的資料或方法。
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(克|g|ml)$/i);
    if (match) {
      return {
        value: match[1],
        type: match[2].toLowerCase() === 'ml' ? 'ml' : '克',
      } as const;
    }
    return {
      value: '',
      type: /ml/i.test(normalized) ? 'ml' : '克',
    } as const;
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleInputItemNameChange = (text: string) => {
    setInputItemName(text);
    setIsSuggestionDropdownOpen(text.trim() !== '');
    filterProductSuggestions(text);
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleSelectProductSuggestion = (product: Product) => {
    setInputItemName(product.name);
    setInputCalories(String(product.calories));
    // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
    const parsedUnit = parseProductUnit(product.unit);
    setInputUnitValue(parsedUnit.value);
    setSelectedUnitType(parsedUnit.type);
    setProductSuggestions([]);
    setIsSuggestionDropdownOpen(false);
  };

  // 說明：宣告 isSearchingProducts，集中處理這段畫面邏輯會用到的資料或方法。
  const isSearchingProducts = inputItemName.trim() !== '' && isLoadingProducts;
  // 說明：控制提示訊息或畫面顯示條件。
  const showNoProductFound = !isLoadingProducts && inputItemName.trim() !== '' && productSuggestions.length === 0;
  // 說明：控制提示訊息或畫面顯示條件。
  const showSuggestionDropdown = isSuggestionDropdownOpen && (isSearchingProducts || productSuggestions.length > 0 || showNoProductFound);

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const loadDataByDate = async (dateStr: string, currentUid: string = userId, heightForBmi: number | null = userHeight) => {
    try {
      // 說明：宣告 savedDataStr，集中處理這段畫面邏輯會用到的資料或方法。
      const savedDataStr = await AsyncStorage.getItem(`${currentUid}_food_record_${dateStr}`);

      // 說明：宣告 normalizeMeals，集中處理這段畫面邏輯會用到的資料或方法。
      const normalizeMeals = (raw: any) => {
        // 說明：宣告 safe，集中處理這段畫面邏輯會用到的資料或方法。
        const safe = raw && typeof raw === 'object' ? raw : {};
        // 說明：宣告 pickArray，集中處理這段畫面邏輯會用到的資料或方法。
        const pickArray = (...keys: string[]) => {
          for (const k of keys) {
            if (Array.isArray(safe[k])) return safe[k];
          }
          return [];
        };
        return {
          早餐: pickArray('早餐', 'breakfast'),
          午餐: pickArray('午餐', 'lunch'),
          晚餐: pickArray('晚餐', 'dinner'),
        };
      };

      if (savedDataStr) {
        // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
        const parsed = JSON.parse(savedDataStr);
        // 說明：宣告 normalizedMeals，集中處理這段畫面邏輯會用到的資料或方法。
        const normalizedMeals = normalizeMeals(parsed.mealBlocks);

        if (parsed.hasDailyWeight === true) {
          // 說明：宣告 savedWeight，集中處理這段畫面邏輯會用到的資料或方法。
          const savedWeight = parsed.weight || '';
          // 說明：宣告 bmiResult，集中處理這段畫面邏輯會用到的資料或方法。
          const bmiResult = calculateBmiByHeight(savedWeight, heightForBmi);

          setWeight(savedWeight);
          setBmi(bmiResult.calculatedBmi);
          setBmiStatus(bmiResult.calculatedStatus);
        } else {
          setWeight('');
          setBmi('—');
          setBmiStatus('');
        }

        setMealBlocks(normalizedMeals);
      } else {
        setWeight('');
        setBmi('—');
        setBmiStatus('');
        setMealBlocks({ 早餐: [], 午餐: [], 晚餐: [] });
      }

      if (/^\d+$/.test(currentUid)) {
        try {
          // 說明：宣告 resp，集中處理這段畫面邏輯會用到的資料或方法。
          const resp = await fetch(`${API_URL}/daily/summary/?member_id=${currentUid}&days=30`);
          if (resp.ok) {
            // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
            const data = await resp.json();
            // 說明：宣告 todayRow，集中處理這段畫面邏輯會用到的資料或方法。
            const todayRow = Array.isArray(data?.records)
              ? data.records.find((r: any) => r?.date === dateStr)
              : null;
            if (todayRow) {
              // 說明：宣告 backendMeals，集中處理這段畫面邏輯會用到的資料或方法。
              const backendMeals = normalizeMeals(todayRow.meals);
              // 說明：宣告 backendHasAny，集中處理這段畫面邏輯會用到的資料或方法。
              const backendHasAny =
                backendMeals.早餐.length + backendMeals.午餐.length + backendMeals.晚餐.length > 0;

              if (backendHasAny) {
                setMealBlocks((prev) => {
                  // 說明：宣告 merged，集中處理這段畫面邏輯會用到的資料或方法。
                  const merged = {
                    早餐: prev.早餐.length ? prev.早餐 : backendMeals.早餐,
                    午餐: prev.午餐.length ? prev.午餐 : backendMeals.午餐,
                    晚餐: prev.晚餐.length ? prev.晚餐 : backendMeals.晚餐,
                  };
                  saveDataToStorage(
                    stateRef.current.weight,
                    stateRef.current.bmi,
                    stateRef.current.bmiStatus,
                    merged,
                  );
                  return merged;
                });
              }

              if (todayRow.weight && (!stateRef.current.weight || stateRef.current.weight === '')) {
                // 說明：宣告 backendWeight，集中處理這段畫面邏輯會用到的資料或方法。
                const backendWeight = String(todayRow.weight);
                // 說明：宣告 bmiResult，集中處理這段畫面邏輯會用到的資料或方法。
                const bmiResult = calculateBmiByHeight(backendWeight, heightForBmi);
                setWeight(backendWeight);
                setBmi(bmiResult.calculatedBmi);
                setBmiStatus(bmiResult.calculatedStatus);
              }
            }
          }
        } catch (e) {
          console.log('從後端補當天紀錄失敗:', e);
        }
      }
    } catch (e) {
      console.error('載入失敗', e);
    }
  };

  // 說明：宣告 saveDataToStorage，集中處理這段畫面邏輯會用到的資料或方法。
  const saveDataToStorage = async (
    currentWeight: string, 
    currentBmi: string, 
    currentBmiStatus: string, 
    currentMeals: typeof mealBlocks
  ) => {
    try {
      // 說明：宣告 effectiveUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveUserId = stateRef.current.userId || userId;
      // 說明：宣告 effectiveDate，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveDate = stateRef.current.currentDate || currentDate;

      // 說明：宣告 hasDailyWeight，集中處理這段畫面邏輯會用到的資料或方法。
      const hasDailyWeight = currentWeight.trim() !== '';

      // 說明：宣告 dataToSave，集中處理這段畫面邏輯會用到的資料或方法。
      const dataToSave = {
        weight: currentWeight,
        bmi: currentBmi,
        bmiStatus: currentBmiStatus,
        mealBlocks: currentMeals,
        hasDailyWeight: hasDailyWeight,
      };

      await AsyncStorage.setItem(
        `${effectiveUserId}_food_record_${effectiveDate}`,
        JSON.stringify(dataToSave)
      );

      if (hasDailyWeight && /^\d+$/.test(effectiveUserId)) {
        await AsyncStorage.setItem(`${effectiveUserId}_user_weight`, currentWeight);
        updateWeight(currentWeight, effectiveUserId);
        updateDailyRecord();
      }

      syncDayToBackend(currentWeight, currentMeals, effectiveUserId, effectiveDate);
    } catch (e) {
      console.error('同步失敗', e);
    }
  };

  // 說明：把前端目前資料同步到後端或其他頁面共用狀態。
  const syncDayToBackend = async (
    currentWeight: string,
    currentMeals: typeof mealBlocks,
    targetUserId?: string,
    targetDate?: string,
  ) => {
    try {
      // 說明：宣告 effectiveUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveUserId = targetUserId || stateRef.current.userId || userId;
      // 說明：宣告 effectiveDate，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveDate = targetDate || stateRef.current.currentDate || currentDate;

      if (!effectiveUserId || effectiveUserId === 'guest') return;
      if (!/^\d+$/.test(effectiveUserId)) return;

      // 說明：宣告 meals，集中處理這段畫面邏輯會用到的資料或方法。
      const meals = {
        breakfast: currentMeals.早餐.map((it) => ({ name: it.name, calories: it.calories })),
        lunch: currentMeals.午餐.map((it) => ({ name: it.name, calories: it.calories })),
        dinner: currentMeals.晚餐.map((it) => ({ name: it.name, calories: it.calories })),
      };

      await fetch(`${API_URL}/daily/save/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: Number(effectiveUserId),
          date: effectiveDate,
          weight: currentWeight,
          meals,
        }),
      });
    } catch (e) {
      console.log('每日紀錄同步到後端失敗（已存本機）:', e);
    }
  };

  // 說明：宣告 getBmiStatusLabel，集中處理這段畫面邏輯會用到的資料或方法。
  const getBmiStatusLabel = (bmiValue: number) => {
    if (bmiValue < 18.5) return '體重過輕';
    if (bmiValue >= 18.5 && bmiValue < 24) return '健康體重';
    if (bmiValue >= 24 && bmiValue < 27) return '體重過重';
    return '肥胖';
  };

  // 說明：宣告 getBmiColor，集中處理這段畫面邏輯會用到的資料或方法。
  const getBmiColor = (status: string) => {
    return status === '健康體重' ? '#2ECC71' : status === '體重過輕' ? '#F1C40F' : '#E74C3C';
  };

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const loadCachedMemberHeight = async (currentUid: string) => {
    try {
      let heightValue = '';
      // 說明：宣告 profileRaw，集中處理這段畫面邏輯會用到的資料或方法。
      const profileRaw = await AsyncStorage.getItem(`${currentUid}_user_profile`);
      if (profileRaw) {
        // 說明：宣告 profile，集中處理這段畫面邏輯會用到的資料或方法。
        const profile = JSON.parse(profileRaw);
        if (profile?.height) {
          heightValue = profile.height.toString();
        }
      }
      if (!heightValue) {
        heightValue =
          (await AsyncStorage.getItem(`${currentUid}_user_height`)) ||
          (await AsyncStorage.getItem(`${currentUid}_height`)) ||
          '';
      }
      // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
      const parsedHeight = parseFloat(heightValue);
      if (!isNaN(parsedHeight) && parsedHeight > 0) {
        setUserHeight(parsedHeight);
        return parsedHeight;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // 說明：從本機快取或後端載入資料，載入完成後更新畫面狀態。
  const loadMemberHeight = async (currentUid: string) => {
    try {
      let heightValue = '';
      if (currentUid && currentUid !== 'guest') {
        try {
          // 說明：宣告 response，集中處理這段畫面邏輯會用到的資料或方法。
          const response = await fetch(`${API_URL}/members/${currentUid}/profile/`);
          // 說明：宣告 data，集中處理這段畫面邏輯會用到的資料或方法。
          const data = await parseApiResponse(response);

          if (response.ok && data.success !== false && data.member?.height !== null && data.member?.height !== undefined) {
            heightValue = String(data.member.height);
            await AsyncStorage.setItem(`${currentUid}_user_height`, heightValue);

            if (data.member?.initial_weight !== null && data.member?.initial_weight !== undefined) {
              await AsyncStorage.setItem(`${currentUid}_user_weight`, String(data.member.initial_weight));
            }

            await AsyncStorage.setItem(
              `${currentUid}_user_profile`,
              JSON.stringify({
                gender: data.member?.gender || '',
                birthday: data.member?.birthday || '',
                height: data.member?.height !== null && data.member?.height !== undefined ? String(data.member.height) : '',
                weight: data.member?.initial_weight !== null && data.member?.initial_weight !== undefined ? String(data.member.initial_weight) : '',
              })
            );
          }
        } catch (e) {
          console.log('從後端讀取會員身高失敗，改用本機快取', e);
        }
      }

      if (!heightValue) {
        // 說明：宣告 profileRaw，集中處理這段畫面邏輯會用到的資料或方法。
        const profileRaw = await AsyncStorage.getItem(`${currentUid}_user_profile`);
        if (profileRaw) {
          // 說明：宣告 profile，集中處理這段畫面邏輯會用到的資料或方法。
          const profile = JSON.parse(profileRaw);
          if (profile?.height) {
            heightValue = profile.height.toString();
          }
        }
      }

      if (!heightValue) {
        heightValue =
          (await AsyncStorage.getItem(`${currentUid}_user_height`)) ||
          (await AsyncStorage.getItem(`${currentUid}_height`)) ||
          '';
      }

      // 說明：清理輸入或後端資料，避免空值、單位字串或格式錯誤影響計算。
      const parsedHeight = parseFloat(heightValue);
      if (!isNaN(parsedHeight) && parsedHeight > 0) {
        setUserHeight(parsedHeight);
        return parsedHeight;
      }
      setUserHeight(null);
      return null;
    } catch (e) {
      console.error('讀取會員中心身高失敗', e);
      setUserHeight(null);
      return null;
    }
  };

  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateBmiByHeight = (inputWeight: string, heightForBmi: number | null) => {
    let calculatedBmi = '—';
    let calculatedStatus = '';
    // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
    const w = parseFloat(inputWeight);
    if (!isNaN(w) && w > 0 && heightForBmi && heightForBmi > 0) {
      // 說明：宣告 hInMeters，集中處理這段畫面邏輯會用到的資料或方法。
      const hInMeters = heightForBmi / 100;
      calculatedBmi = (w / (hInMeters * hInMeters)).toFixed(1);
      calculatedStatus = getBmiStatusLabel(parseFloat(calculatedBmi));
    }
    return { calculatedBmi, calculatedStatus };
  };

  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const updateMemberWeightLocalCache = async (_newWeight: string) => {
    try {
      // 說明：宣告 effectiveUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveUserId = stateRef.current.userId;
      if (!effectiveUserId || effectiveUserId === 'guest') return;
      
      // 說明：宣告 profileRaw，集中處理這段畫面邏輯會用到的資料或方法。
      const profileRaw = await AsyncStorage.getItem(`${effectiveUserId}_user_profile`);
      if (profileRaw) {
        // 說明：宣告 profile，集中處理這段畫面邏輯會用到的資料或方法。
        const profile = JSON.parse(profileRaw);
        profile.weight = _newWeight;
        await AsyncStorage.setItem(`${effectiveUserId}_user_profile`, JSON.stringify(profile));
      }
    } catch (e) {
      console.log('同步到會員中心快取失敗:', e);
    }
  };

  // 說明：宣告 updateMemberWeightToBackend，集中處理這段畫面邏輯會用到的資料或方法。
  const updateMemberWeightToBackend = async (_newWeight: string) => {
    try {
      // 說明：宣告 effectiveUserId，集中處理這段畫面邏輯會用到的資料或方法。
      const effectiveUserId = stateRef.current.userId;
      if (!effectiveUserId || effectiveUserId === 'guest') return;
      await fetch(`${API_URL}/member/profile/${effectiveUserId}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_weight: _newWeight }),
      });
    } catch (e) {
      console.log('同步到會員中心後端失敗:', e);
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleWeightChange = (text: string) => {
    let cleanedText = text.replace(/[^0-9.]/g, '');
    // 說明：宣告 parts，集中處理這段畫面邏輯會用到的資料或方法。
    const parts = cleanedText.split('.');
    if (parts.length > 2) cleanedText = `${parts[0]}.${parts.slice(1).join('')}`;
    setWeight(cleanedText);

    const { calculatedBmi, calculatedStatus } = calculateBmiByHeight(cleanedText, userHeight);
    setBmi(calculatedBmi);
    setBmiStatus(calculatedStatus);
    saveDataToStorage(cleanedText, calculatedBmi, calculatedStatus, mealBlocks);

    // 說明：宣告 weightNum，集中處理這段畫面邏輯會用到的資料或方法。
    const weightNum = parseFloat(cleanedText);
    if (!isNaN(weightNum) && weightNum >= 30 && weightNum <= 200) {
      updateMemberWeightLocalCache(cleanedText);
      if (weightSyncTimerRef.current) clearTimeout(weightSyncTimerRef.current);
      weightSyncTimerRef.current = setTimeout(() => {
        updateMemberWeightToBackend(cleanedText);
      }, 600);
    }
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleWeightBlur = async () => {
    if (weight.trim() === '') {
      setWeight('');
      setBmi('—');
      setBmiStatus('');
      saveDataToStorage('', '—', '', mealBlocks);
      return;
    }
    // 說明：宣告 w，集中處理這段畫面邏輯會用到的資料或方法。
    const w = parseFloat(weight);
    let finalWeight = weight;

    if (isNaN(w)) {
      finalWeight = '';
      setWeight('');
      setBmi('—');
      setBmiStatus('');
    } else if (w < 30) {
      finalWeight = '30';
      setWeight('30');
      showAlert('⚠️ 體重輸入限制範圍為 30 ~ 200 KG\n已自動修正為：30 KG');
    } else if (w > 200) {
      finalWeight = '200';
      setWeight('200');
      showAlert('⚠️ 體重輸入限制範圍為 30 ~ 200 KG\n已自動修正為：200 KG');
    }

    const { calculatedBmi, calculatedStatus } = calculateBmiByHeight(finalWeight, userHeight);
    setBmi(calculatedBmi);
    setBmiStatus(calculatedStatus);
    saveDataToStorage(finalWeight, calculatedBmi, calculatedStatus, mealBlocks);

    await updateMemberWeightLocalCache(finalWeight);
    updateMemberWeightToBackend(finalWeight);
  };

  // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
  const calculateTotalCalories = () => {
    let total = 0;
    Object.values(mealBlocks).forEach((foods) => {
      foods.forEach((item) => {
        // 說明：宣告 cal，集中處理這段畫面邏輯會用到的資料或方法。
        const cal = parseInt(item.calories, 10);
        if (!isNaN(cal)) total += cal;
      });
    });
    return total;
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleDeleteItem = (category: '早餐' | '午餐' | '晚餐', id: string, name: string) => {
    showConfirm('確認刪除', `您確定要刪除「${name || '此品項'}」嗎？`, () => {
      // 說明：宣告 updatedMeals，集中處理這段畫面邏輯會用到的資料或方法。
      const updatedMeals = {
        ...mealBlocks,
        [category]: mealBlocks[category].filter(item => item.id !== id)
      };
      setMealBlocks(updatedMeals);
      saveDataToStorage(weight, bmi, bmiStatus, updatedMeals);
    });
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleConfirmAddItem = () => {
    // 說明：宣告 trimmedItemName，集中處理這段畫面邏輯會用到的資料或方法。
    const trimmedItemName = inputItemName.trim();
    // 說明：宣告 trimmedUnitValue，集中處理這段畫面邏輯會用到的資料或方法。
    const trimmedUnitValue = inputUnitValue.trim();
    // 說明：宣告 trimmedCalories，集中處理這段畫面邏輯會用到的資料或方法。
    const trimmedCalories = inputCalories.trim(); 

    if (!trimmedItemName || !trimmedUnitValue || !trimmedCalories) {
      showAlert('欄位未填寫完整\n請輸入完整的品項、份量數值與熱量。');
      return;
    }

    // 說明：根據目前輸入或紀錄重新計算畫面要顯示的數值。
    const totalCalcCalories = String(Math.round(parseFloat(trimmedCalories) * servings));
    // 🛠️ 依照需求修改儲存格式：將單份熱量顯示為「X大卡/份」，並使用 * 代替 x
    // 說明：宣告 finalFullName，集中處理這段畫面邏輯會用到的資料或方法。
    const finalFullName = `${trimmedItemName}/${trimmedUnitValue}${selectedUnitType} * ${servings}份 (${trimmedCalories}大卡/份)`;

    let updatedMeals: typeof mealBlocks;
    if (editingItemId) {
      updatedMeals = {
        ...mealBlocks,
        [currentBlockCategory]: mealBlocks[currentBlockCategory].map((it) =>
          it.id === editingItemId
            ? { ...it, name: finalFullName, calories: totalCalcCalories, singleCalories: trimmedCalories, servings: servings }
            : it
        ),
      };
    } else {
      const newItem: FoodItem = {
        id: Date.now().toString(),
        name: finalFullName,
        calories: totalCalcCalories,
        singleCalories: trimmedCalories,
        servings: servings
      };
      updatedMeals = {
        ...mealBlocks,
        [currentBlockCategory]: [...mealBlocks[currentBlockCategory], newItem],
      };
    }

    setMealBlocks(updatedMeals);
    saveDataToStorage(weight, bmi, bmiStatus, updatedMeals);
    resetModalInputs();
    setAddModalVisible(false);
  };

  // 說明：宣告 openEditModalForItem，集中處理這段畫面邏輯會用到的資料或方法。
  const openEditModalForItem = (
    category: '早餐' | '午餐' | '晚餐',
    item: FoodItem
  ) => {
    // 🛠️ 修復：改用 indexOf 尋找第一個斜線，避免被熱量格式中的「/份」干擾
    // 說明：宣告 firstSlash，集中處理這段畫面邏輯會用到的資料或方法。
    const firstSlash = item.name.indexOf('/');
    let nameOnly = item.name;
    let unitValue = '';
    let unitType: '克' | 'ml' = '克';
    let savedServings = item.servings || 1;
    let savedSingleCal = item.singleCalories || item.calories;

    if (firstSlash !== -1) {
      nameOnly = item.name.slice(0, firstSlash);
      // 說明：宣告 unitPart，集中處理這段畫面邏輯會用到的資料或方法。
      const unitPart = item.name.slice(firstSlash + 1);
      // 🛠️ 修改正則表達式，使其能同時解析 x 或 * 符號
      // 說明：宣告 m，集中處理這段畫面邏輯會用到的資料或方法。
      const m = unitPart.match(/^(\d+)(克|ml)(?:\s*[x*]\s*(\d+)份)?/);
      if (m) {
        unitValue = m[1];
        unitType = m[2] as '克' | 'ml';
        if (m[3]) savedServings = parseInt(m[3], 10);
      }
    }

    setCurrentBlockCategory(category);
    setInputItemName(nameOnly);
    setInputUnitValue(unitValue);
    setSelectedUnitType(unitType);
    setInputCalories(savedSingleCal);
    setServings(savedServings);
    setEditingItemId(item.id);
    setAddModalVisible(true);
  };

  // 說明：處理使用者在畫面上的操作，例如點擊、輸入、確認或取消。
  const handleCancelAddItem = () => {
    // 說明：宣告 isEditing，集中處理這段畫面邏輯會用到的資料或方法。
    const isEditing = editingItemId !== null;
    if (inputItemName.trim() !== '' || inputUnitValue.trim() !== '' || inputCalories.trim() !== '') {
      showConfirm(
        isEditing ? '確認取消' : '確認取消',
        isEditing ? '確定要取消編輯嗎？修改將不會被儲存。' : '確定要取消新增嗎？內容將不會被儲存。',
        () => {
          resetModalInputs();
          setAddModalVisible(false);
        },
      );
    } else {
      resetModalInputs();
      setAddModalVisible(false);
    }
  };

  // 說明：宣告 resetModalInputs，集中處理這段畫面邏輯會用到的資料或方法。
  const resetModalInputs = () => {
    setInputItemName('');
    setInputUnitValue('');
    setSelectedUnitType('克');
    setInputCalories('');
    setServings(1);
    setEditingItemId(null);
    setProductSuggestions([]);
    setIsServingsDropdownOpen(false);
  };

  // 說明：宣告 openAddModalForCategory，集中處理這段畫面邏輯會用到的資料或方法。
  const openAddModalForCategory = (category: '早餐' | '午餐' | '晚餐') => {
    resetModalInputs();
    setCurrentBlockCategory(category);
    setAddModalVisible(true);
  };

  // 說明：控制提示訊息或畫面顯示條件。
  const showAlert = (message: string) => {
    setAlertMessage(message);
    setAlertModalVisible(true);
  };

  // 說明：控制提示訊息或畫面顯示條件。
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmModalVisible(true);
  };

  // 說明：回傳此頁的畫面結構；上方 state 和 handler 會在這裡被綁到 UI 元件上。
  return (
    <View style={{ flex: 1, backgroundColor: '#E0E7DA' }}>
      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordCard}>
          
          <View style={styles.titleRow}>
            <View style={styles.titleWithDateGroup}>
              <Text style={styles.mainTitle}>每日紀錄</Text>
              <Text style={styles.todayDateText}>{currentDate.replace(/-/g, '/')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/weightpic')}>
              <Text style={styles.linkText}>點我看體重紀錄</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightSection}>
            <View style={styles.weightInputRow}>
              <Text style={styles.label}>今日體重</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入體重 (30~200 KG)"
                placeholderTextColor="#A9A9A9"
                value={weight}
                keyboardType="numeric"
                onChangeText={handleWeightChange}
                onBlur={handleWeightBlur}
              />
            </View>
            <View style={styles.bmiRow}>
              <Text style={styles.bmiValue}>BMI 值： {bmi}</Text>
              {bmiStatus ? (
                <View style={[styles.bmiStatusTag, { backgroundColor: getBmiColor(bmiStatus) }]}>
                  <Text style={styles.bmiStatusText}>{bmiStatus}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {(['早餐', '午餐', '晚餐'] as const).map((category) => (
            <View key={category} style={styles.mealBlockCard}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockCategoryTitle}>{category}</Text>
                <TouchableOpacity style={styles.blockAddBtn} onPress={() => openAddModalForCategory(category)}>
                  <Text style={styles.blockAddBtnText}>+ 新增品項</Text>
                </TouchableOpacity>
              </View>

              {mealBlocks[category] && mealBlocks[category].length > 0 && (
                <View style={styles.tableHeader}>
                  <Text style={[styles.thLabel, { flex: 3 }]}>品項 / 單位</Text>
                  <Text style={[styles.thLabel, { flex: 1, textAlign: 'right', marginRight: 65 }]}>熱量 (大卡)</Text>
                </View>
              )}

              {mealBlocks[category] && mealBlocks[category].map((food) => (
                <View key={food.id} style={styles.tableRow}>
                  <View style={{ flex: 3, paddingVertical: 6 }}>
                    <Text style={styles.tableTextContent}>{food.name}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 15 }}>
                    <Text style={styles.tableTextContent}>{food.calories}</Text>
                  </View>
                  <TouchableOpacity style={styles.editRowTextBtn} onPress={() => openEditModalForItem(category, food)}>
                    <Text style={styles.editRowText}>編輯</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteRowTextBtn} onPress={() => handleDeleteItem(category, food.id, food.name)}>
                    <Text style={styles.deleteRowText}>刪除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.totalCaloriesCard}>
            <Text style={styles.totalCaloriesLabel}>今日攝取總熱量</Text>
            <View style={styles.totalCaloriesValueGroup}>
              <Text style={styles.totalCaloriesNumber}>{calculateTotalCalories()}</Text>
              <Text style={styles.totalCaloriesUnit}> 大卡</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* 新增/編輯飲食彈窗 */}
      <Modal animationType="fade" transparent={true} visible={addModalVisible} onRequestClose={handleCancelAddItem}>
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>{editingItemId ? '編輯飲食紀錄' : '新增飲食紀錄'}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>新增類別</Text>
              <View style={styles.disabledSelectBox}><Text style={styles.disabledSelectText}>{currentBlockCategory}</Text></View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>品項名稱</Text>
              <TextInput
                style={[styles.popupInput, showSuggestionDropdown && styles.popupInputWithDropdown]}
                placeholder="例如：火腿蛋餅"
                placeholderTextColor="#A9A9A9"
                value={inputItemName}
                onChangeText={handleInputItemNameChange}
              />
              {showSuggestionDropdown && (
                <View style={styles.suggestionsContainer}>
                  {isSearchingProducts ? (
                    <Text style={styles.noSuggestionText}>搜尋中...</Text>
                  ) : productSuggestions.length > 0 ? (
                    <ScrollView style={styles.suggestionsScroll} nestedScrollEnabled={true}>
                      {productSuggestions.map((product) => (
                        <TouchableOpacity
                          key={product.id}
                          style={styles.suggestionItem}
                          onPress={() => handleSelectProductSuggestion(product)}
                        >
                          <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">
                            {product.name}
                          </Text>
                          <Text style={styles.suggestionMeta} numberOfLines={1} ellipsizeMode="tail">
                            {product.unit ? `${product.unit} · ` : ''}{product.calories} 大卡
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.noSuggestionText}>查無商品</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>份量與單位</Text>
              <View style={styles.unitSelectorContainer}>
                <TextInput style={styles.unitNumberInput} placeholder="限輸入數字" placeholderTextColor="#A9A9A9" keyboardType="numeric" value={inputUnitValue} onChangeText={(text) => setInputUnitValue(text.replace(/[^0-9]/g, ''))} />
                <View style={styles.toggleButtonGroup}>
                  <TouchableOpacity style={[styles.toggleBtn, selectedUnitType === '克' && styles.toggleBtnActive]} onPress={() => setSelectedUnitType('克')}>
                    <Text style={[styles.toggleBtnText, selectedUnitType === '克' && styles.toggleBtnTextActive]}>克</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, selectedUnitType === 'ml' && styles.toggleBtnActive]} onPress={() => setSelectedUnitType('ml')}>
                    <Text style={[styles.toggleBtnText, selectedUnitType === 'ml' && styles.toggleBtnTextActive]}>ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>單份熱量 (大卡)</Text>
              <TextInput style={styles.popupInput} placeholder="限輸入數字" placeholderTextColor="#A9A9A9" keyboardType="numeric" value={inputCalories} onChangeText={(text) => setInputCalories(text.replace(/[^0-9]/g, ''))} />
            </View>

            {/* 🎯 關鍵修復點：將全體下拉選單放入獨立的高層級 zIndex 容器，並且提供定高包覆，不再穿透 */}
            <View style={[styles.inputGroup, { zIndex: 9999, minHeight: 75 }]}>
              <Text style={styles.inputLabel}>份 數</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector} 
                onPress={() => setIsServingsDropdownOpen(!isServingsDropdownOpen)}
              >
                <Text style={styles.dropdownSelectorText}>{servings} 份</Text>
                <Text style={styles.dropdownArrow}>{isServingsDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              
              {isServingsDropdownOpen && (
                <View style={styles.dropdownListContainer}>
                  <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled={true}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => (
                      <TouchableOpacity 
                        key={num} 
                        style={styles.dropdownItem} 
                        onPress={() => {
                          setServings(num);
                          setIsServingsDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{num} 份</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnLeft} onPress={handleCancelAddItem}>
                <Text style={styles.modalBtnLeftText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnRight} onPress={handleConfirmAddItem}>
                <Text style={styles.modalBtnRightText}>{editingItemId ? '確認修改' : '確認新增'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 提示與確認彈窗 */}
      <Modal animationType="fade" transparent={true} visible={alertModalVisible} onRequestClose={() => setAlertModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>⚠️ 提示</Text>
            <Text style={styles.alertPopupMessage}>{alertMessage}</Text>
            <TouchableOpacity style={styles.alertSingleBtn} onPress={() => setAlertModalVisible(false)}>
              <Text style={styles.alertSingleBtnText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={confirmModalVisible} onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertPopupBox}>
            <Text style={styles.alertPopupTitle}>{confirmTitle}</Text>
            <Text style={styles.alertPopupMessage}>{confirmMessage}</Text>
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity style={styles.modalBtnLeft} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.modalBtnLeftText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnRight} onPress={() => { setConfirmModalVisible(false); confirmAction(); }}>
                <Text style={styles.modalBtnRightText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// 說明：集中定義本頁所有樣式，讓 JSX 只負責描述畫面結構。
const styles = StyleSheet.create({
  scrollContent: { minHeight: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5DC', paddingVertical: 40 },
  recordCard: { backgroundColor: 'white', width: '65%', minWidth: 650, borderRadius: 40, padding: 50 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#EEE', paddingBottom: 10 },
  titleWithDateGroup: { flexDirection: 'row', alignItems: 'baseline' },
  mainTitle: { fontSize: 36, fontWeight: 'bold', color: '#333' },
  todayDateText: { fontSize: 22, color: '#666', fontWeight: '600', marginLeft: 15 },
  linkText: { fontSize: 20, color: '#F3B07E', fontWeight: '600' },
  weightSection: { marginBottom: 25 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 22, fontWeight: '600', color: '#444' },
  input: { width: '40%', fontSize: 20, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#CCC', paddingVertical: 4 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5 },
  bmiValue: { fontSize: 20, color: '#888', fontWeight: '500', marginRight: 10 },
  bmiStatusTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  bmiStatusText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  mealBlockCard: { backgroundColor: '#FCFCF9', borderWidth: 1, borderColor: '#EDEEEA', borderRadius: 20, padding: 25, marginBottom: 30, minHeight: 90 },
  blockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  blockCategoryTitle: { fontSize: 24, fontWeight: 'bold', color: '#2C3E50' },
  blockAddBtn: { backgroundColor: '#A3C1AD', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 10 },
  blockAddBtnText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 6, marginBottom: 12 },
  thLabel: { fontSize: 18, fontWeight: '600', color: '#7F8C8D', textAlign: 'left' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tableTextContent: { fontSize: 18, color: '#333', fontWeight: '500' },
  editRowTextBtn: { paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10, backgroundColor: '#D6E4D2', borderRadius: 8 },
  editRowText: { fontSize: 15, color: '#3D6A4A', fontWeight: 'bold' },
  deleteRowTextBtn: { paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10, backgroundColor: '#FADBD8', borderRadius: 8 },
  deleteRowText: { fontSize: 15, color: '#C0392B', fontWeight: 'bold' },
  totalCaloriesCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF2E6', borderWidth: 1, borderColor: '#F3B07E', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 30 },
  totalCaloriesLabel: { fontSize: 22, fontWeight: 'bold', color: '#D35400' },
  totalCaloriesValueGroup: { flexDirection: 'row', alignItems: 'baseline' },
  totalCaloriesNumber: { fontSize: 32, fontWeight: 'bold', color: '#E67E22' },
  totalCaloriesUnit: { fontSize: 18, fontWeight: '600', color: '#7F8C8D' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  // 🎯 這裡加上 paddingBottom 保留空間
  popupBox: { backgroundColor: '#FFF', width: 460, paddingHorizontal: 35, paddingTop: 30, paddingBottom: 45, borderRadius: 25 },
  popupTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 25, textAlign: 'center' },
  inputGroup: { marginBottom: 18, position: 'relative' },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#4A4A4A', marginBottom: 8 },
  disabledSelectBox: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EEEEEE' },
  disabledSelectText: { fontSize: 16, color: '#666', fontWeight: 'bold' },
  popupInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA' },
  popupInputWithDropdown: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  suggestionsContainer: { marginTop: -1, maxHeight: 180, borderWidth: 1, borderColor: '#E2E8F0', borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: '#FFF', overflow: 'hidden' },
  suggestionsScroll: { maxHeight: 180 },
  suggestionItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestionText: { fontSize: 15, color: '#1F2937', fontWeight: '600', flexShrink: 1 },
  suggestionMeta: { fontSize: 13, color: '#6B7280', marginTop: 4, flexShrink: 1 },
  noSuggestionText: { fontSize: 14, color: '#9CA3AF', marginTop: 8, paddingHorizontal: 4, paddingVertical: 10 },
  unitSelectorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitNumberInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333', backgroundColor: '#FAFAFA', marginRight: 15 },
  toggleButtonGroup: { flexDirection: 'row', borderWidth: 1, borderColor: '#A3C1AD', borderRadius: 10, overflow: 'hidden', height: 44, width: 120 },
  toggleBtn: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#A3C1AD' },
  toggleBtnText: { fontSize: 15, color: '#A3C1AD', fontWeight: '600' },
  toggleBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: '#000', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#FFF' },
  dropdownSelectorText: { fontSize: 16, color: '#333', fontWeight: '500' },
  dropdownArrow: { fontSize: 12, color: '#666' },
  
  // 🎯 核心修復點：這層容器改為絕對定位，並設定極高的 zIndex: 99999 與陰影，確保它像遮罩一樣完全浮在按鈕列上空
  dropdownListContainer: { position: 'absolute', top: 78, left: 0, right: 0, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#000', borderRadius: 12, overflow: 'hidden', zIndex: 99999, elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 5 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropdownItemText: { fontSize: 16, color: '#333' },

  // 🎯 給予按鈕群一個合理的上邊距
  modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 25 },
  modalBtnLeft: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#333' },
  modalBtnLeftText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  modalBtnRight: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6, backgroundColor: '#E67E22' },
  modalBtnRightText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  alertPopupBox: { backgroundColor: '#FFF', width: 360, padding: 25, borderRadius: 20, alignItems: 'center' },
  alertPopupTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  alertPopupMessage: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24, marginBottom: 25 },
  alertSingleBtn: { backgroundColor: '#A3C1AD', width: '100%', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertSingleBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});