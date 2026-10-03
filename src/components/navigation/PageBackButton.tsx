import React from 'react';
export { SubpageBackButton } from './SubpageBackButton';

// PageBackButton is now integrated directly inside subpage header cards to avoid improper top margins
export const PageBackButton: React.FC = () => {
  return null;
};

export const PageBreadcrumbs = PageBackButton;
export default PageBackButton;
