import React from 'react';
import { EtihadTanksView } from './EtihadTanksView';

/** صفحة خزانات الصحاري: نفس تصميم خزانات الاتحاد، بأقسام الصحاري في منظومة الخزانات */
export const SaharaTanksView: React.FC<{ onBack?: () => void }> = ({ onBack }) => <EtihadTanksView company="sahara" onBack={onBack} />;

export default SaharaTanksView;
