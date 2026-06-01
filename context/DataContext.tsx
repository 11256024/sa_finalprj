import React, { createContext, useContext, useState } from 'react';

interface DataContextType {
  recordUpdateVersion: number;
  weightUpdateVersion: number;
  lastWeightValue: string; // 🎯 新增：儲存最新的體重數值
  updateDailyRecord: () => void;
  updateWeight: (weight: string, memberId: string) => void;
  triggerAchievementsRefresh: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [recordUpdateVersion, setRecordUpdateVersion] = useState(0);
  const [weightUpdateVersion, setWeightUpdateVersion] = useState(0);
  const [lastWeightValue, setLastWeightValue] = useState(''); // 🎯 記憶體狀態

  const updateDailyRecord = () => {
    setRecordUpdateVersion((prev) => prev + 1);
  };

  const updateWeight = (weight: string, memberId: string) => {
    setLastWeightValue(weight); // 🎯 立即更新記憶體中的數值
    setWeightUpdateVersion((prev) => prev + 1);
  };

  const triggerAchievementsRefresh = () => {
    setRecordUpdateVersion((prev) => prev + 1);
  };

  return (
    <DataContext.Provider
      value={{
        recordUpdateVersion,
        weightUpdateVersion,
        lastWeightValue,
        updateDailyRecord,
        updateWeight,
        triggerAchievementsRefresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider');
  }
  return context;
};
