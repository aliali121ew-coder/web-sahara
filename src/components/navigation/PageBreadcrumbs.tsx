import React from 'react';
import { PageBackButton } from './PageBackButton';

// Re-export PageBackButton as PageBreadcrumbs for backwards compatibility
export const PageBreadcrumbs: React.FC = () => {
  return <PageBackButton />;
};

export default PageBreadcrumbs;
