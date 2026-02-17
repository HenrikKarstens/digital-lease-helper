import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ViewMode = 'standard' | 'compact' | 'contrast' | 'dark';

interface ThemeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('estate-turn-theme') as ViewMode) || 'standard';
  });

  useEffect(() => {
    localStorage.setItem('estate-turn-theme', viewMode);
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('dark', 'compact', 'high-contrast');
    
    switch (viewMode) {
      case 'dark':
        root.classList.add('dark');
        break;
      case 'compact':
        root.classList.add('compact');
        break;
      case 'contrast':
        root.classList.add('high-contrast');
        break;
    }
  }, [viewMode]);

  return (
    <ThemeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
