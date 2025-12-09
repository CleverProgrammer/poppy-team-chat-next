import { Knock } from '@knocklabs/node';

// Initialize Knock client
let knockClient = null;

// Get Knock client instance (lazy initialization)
function getKnockClient() {
  if (typeof window !== 'undefined') {
    // Running on client side, return null
    return null;
  }

  if (!knockClient) {
    knockClient = new Knock(process.env.KNOCK_API_KEY);
  }

  return knockClient;
}

// Identify user in Knock
export async function identifyKnockUser(user) {
  if (!user) {
    console.log('⚠️  [Knock] No user provided to identifyKnockUser');
    return;
  }

  const knock = getKnockClient();
  if (!knock) {
    console.log('⚠️  [Knock] getKnockClient returned null (running on client side)');
    return;
  }

  try {
    console.log('🟡 [Knock] Identifying user:', user.uid, user.email);
    await knock.users.update(user.uid, {
      name: user.displayName || user.email,
      email: user.email,
      avatar: user.photoURL || ''
    });
    console.log('✅ [Knock] User identified successfully');
  } catch (error) {
    console.error('❌ [Knock] Error identifying user:', error);
  }
}

// Notify user of new DM
export async function notifyNewDM(senderId, recipientId, messageText, senderName) {
  const knock = getKnockClient();
  if (!knock) return;

  try {
    await knock.workflows.trigger('new-dm-message', {
      recipients: [recipientId],
      data: {
        senderId,
        senderName,
        messagePreview: messageText.substring(0, 100),
        messageUrl: `/chat?dm=${senderId}`
      }
    });
  } catch (error) {
    console.error('Error triggering DM notification:', error);
  }
}

// Notify channel of new message
export async function notifyNewChannelMessage(senderId, channelId, messageText, senderName, allUsers) {
  const knock = getKnockClient();
  if (!knock) return;

  try {
    // Get all users except the sender
    const recipients = allUsers
      .filter(user => user.uid !== senderId)
      .map(user => user.uid);

    if (recipients.length === 0) return;

    await knock.workflows.trigger('new-channel-message', {
      recipients,
      data: {
        senderId,
        senderName,
        channelId,
        channelName: channelId,
        messagePreview: messageText.substring(0, 100),
        messageUrl: `/chat?channel=${channelId}`
      }
    });
  } catch (error) {
    console.error('Error triggering channel notification:', error);
  }
}
