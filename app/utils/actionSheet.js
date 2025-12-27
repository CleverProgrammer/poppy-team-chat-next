'use client';

import { ActionSheet } from '@capacitor/action-sheet';
import { Capacitor } from '@capacitor/core';
import { hapticLight, hapticHeavy } from './haptics';
import { DEFAULT_EMOJIS } from '../constants/emojis';

/**
 * Native iOS Action Sheet for reactions (double-tap)
 * Shows top 6 reaction emojis in a native iOS action sheet
 */
export const showReactionsSheet = async (onReaction) => {
  // Only use native action sheet on iOS/Android
  if (!Capacitor.isNativePlatform()) {
    return { native: false };
  }

  hapticLight();
  
  const result = await ActionSheet.showActions({
    title: 'React',
    options: [
      { title: DEFAULT_EMOJIS[0] }, // 🤩
      { title: DEFAULT_EMOJIS[1] }, // ❤️
      { title: DEFAULT_EMOJIS[2] }, // 😊
      { title: DEFAULT_EMOJIS[3] }, // 😱
      { title: DEFAULT_EMOJIS[4] }, // 🔥
      { title: DEFAULT_EMOJIS[5] }, // 💪
    ],
  });

  // User didn't cancel (index !== -1 and index is valid)
  if (result.index >= 0 && result.index < 6) {
    hapticLight();
    onReaction(DEFAULT_EMOJIS[result.index]);
  }

  return { native: true };
};

/**
 * Native iOS Action Sheet for full message actions (long-press)
 * Shows reactions + Reply, Edit, Delete, etc.
 */
export const showMessageActionsSheet = async ({
  isOwnMessage,
  isPost,
  onReaction,
  onReply,
  onEdit,
  onDelete,
  onPromote,
  onDemote,
  onAddToTeamMemory,
}) => {
  // Only use native action sheet on iOS/Android
  if (!Capacitor.isNativePlatform()) {
    return { native: false };
  }

  hapticHeavy();

  const options = [];

  // Reactions first (top 6)
  if (!isPost) {
    DEFAULT_EMOJIS.slice(0, 6).forEach(emoji => {
      options.push({ title: emoji });
    });
  }

  // Action buttons
  if (!isPost) {
    options.push({ title: '↩ Reply' });
  }
  
  if (isOwnMessage && !isPost) {
    options.push({ title: '✏️ Edit' });
    options.push({ title: '💀 Undo Send' });
  }

  if (!isPost) {
    options.push({ title: '📌 Make it a post' });
  }

  if (isPost) {
    options.push({ title: '💬 Make it a message' });
  }

  if (isOwnMessage) {
    options.push({ title: '🧠 Team Memory' });
  }

  const result = await ActionSheet.showActions({
    title: 'Message Options',
    options,
  });

  if (result.index === -1) {
    return { native: true }; // User cancelled
  }

  const selectedTitle = options[result.index]?.title;

  // Handle reactions (first 6 options if not a post)
  if (!isPost && result.index < 6) {
    hapticLight();
    onReaction?.(DEFAULT_EMOJIS[result.index]);
    return { native: true };
  }

  // Handle action buttons
  hapticLight();
  
  switch (selectedTitle) {
    case '↩ Reply':
      onReply?.();
      break;
    case '✏️ Edit':
      onEdit?.();
      break;
    case '💀 Undo Send':
      onDelete?.();
      break;
    case '📌 Make it a post':
      onPromote?.();
      break;
    case '💬 Make it a message':
      onDemote?.();
      break;
    case '🧠 Team Memory':
      onAddToTeamMemory?.();
      break;
  }

  return { native: true };
};

/**
 * Detect if we should use native action sheets
 */
export const shouldUseNativeSheet = () => {
  return Capacitor.isNativePlatform();
};

