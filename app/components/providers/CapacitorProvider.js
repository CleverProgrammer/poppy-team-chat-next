'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export default function CapacitorProvider({ children }) {
  useEffect(() => {
    const setupKeyboard = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          // Hide the form accessory bar (autofill suggestions)
          await Keyboard.setAccessoryBarVisible({ isVisible: false });
          console.log('Keyboard accessory bar hidden');
        } catch (error) {
          console.error('Failed to configure keyboard:', error);
        }
      }
    };

    setupKeyboard();
  }, []);

  return children;
}
