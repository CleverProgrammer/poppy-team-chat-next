'use client';

// Haptic feedback utilities for iOS/mobile
// Uses Capacitor Haptics on native, falls back to navigator.vibrate on web

let Haptics = null;
let ImpactStyle = null;
let NotificationType = null;

// Dynamically import Capacitor Haptics (only works on native)
if (typeof window !== 'undefined') {
  import('@capacitor/haptics').then((module) => {
    Haptics = module.Haptics;
    ImpactStyle = module.ImpactStyle;
    NotificationType = module.NotificationType;
  }).catch(() => {
    // Not available (web browser without Capacitor)
  });
}

// Light tap - for UI feedback like button presses
export async function hapticLight() {
  try {
    if (Haptics && ImpactStyle) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch (e) {
    // Silently fail - haptics not critical
  }
}

// Medium tap - for selections, toggles
export async function hapticMedium() {
  try {
    if (Haptics && ImpactStyle) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (navigator.vibrate) {
      navigator.vibrate(25);
    }
  } catch (e) {
    // Silently fail
  }
}

// Heavy tap - for important actions like long press context menu
export async function hapticHeavy() {
  try {
    if (Haptics && ImpactStyle) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  } catch (e) {
    // Silently fail
  }
}

// Success notification - for completed actions
export async function hapticSuccess() {
  try {
    if (Haptics && NotificationType) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  } catch (e) {
    // Silently fail
  }
}

// Selection changed - subtle tick for selections
export async function hapticSelection() {
  try {
    if (Haptics) {
      await Haptics.selectionChanged();
    } else if (navigator.vibrate) {
      navigator.vibrate(5);
    }
  } catch (e) {
    // Silently fail
  }
}

