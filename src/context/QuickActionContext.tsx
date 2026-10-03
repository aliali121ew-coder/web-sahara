import { createContext, useContext } from 'react';

/** فتح نافذة الإضافة/التعديل الموحّدة (QuickActionModal) من أي صفحة داخل البرنامج */
export type OpenQuickAction = (data?: any) => void;

export const QuickActionContext = createContext<OpenQuickAction>(() => {});

export const useQuickAction = () => useContext(QuickActionContext);
