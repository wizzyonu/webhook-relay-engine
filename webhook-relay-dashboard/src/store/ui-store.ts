// src/store/ui-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isDetailDrawerOpen: boolean;
  selectedEventId: string | null;
  isDarkMode: boolean;
  
  openDetailDrawer: (eventId: string) => void;
  closeDetailDrawer: () => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isDetailDrawerOpen: false,
      selectedEventId: null,
      isDarkMode: false,
      
      openDetailDrawer: (eventId) => set({ isDetailDrawerOpen: true, selectedEventId: eventId }),
      closeDetailDrawer: () => set({ isDetailDrawerOpen: false, selectedEventId: null }),
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    }),
    {
      name: 'webhook-ui-storage',
      // Only persist the theme, not transient UI state like drawer visibility
      partialize: (state) => ({ isDarkMode: state.isDarkMode }), 
    }
  )
);