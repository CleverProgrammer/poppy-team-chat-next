const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();

// Send push notification when a new channel message is created
exports.sendChannelNotification = onDocumentCreated(
  'channels/{channelId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const { channelId } = event.params;

    console.log(`New message in channel ${channelId}:`, message.text?.substring(0, 50));

    try {
      // Get all users with push tokens (except the sender)
      const usersSnapshot = await db.collection('users').get();
      const tokens = [];

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        // Don't send notification to the sender
        if (userData.pushToken && userData.uid !== message.senderId) {
          tokens.push(userData.pushToken);
        }
      });

      if (tokens.length === 0) {
        console.log('No push tokens found');
        return;
      }

      // Send notification
      const notification = {
        notification: {
          title: `#${channelId}`,
          body: `${message.sender}: ${message.text?.substring(0, 100) || 'New message'}`,
        },
        data: {
          type: 'channel',
          channelId: channelId,
          messageId: event.params.messageId,
          sender: message.sender || '',
          senderId: message.senderId || '',
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              'mutable-content': 1,
            },
          },
        },
        tokens: tokens,
      };

      const response = await getMessaging().sendEachForMulticast(notification);
      console.log(`Notifications sent: ${response.successCount} succeeded, ${response.failureCount} failed`);

      // Log any failures
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Failed to send to token ${idx}:`, resp.error?.message);
          }
        });
      }
    } catch (error) {
      console.error('Error sending channel notification:', error);
    }
  }
);

// Send push notification when a new DM message is created
exports.sendDMNotification = onDocumentCreated(
  'dms/{dmId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const { dmId } = event.params;

    console.log(`New DM in ${dmId}:`, message.text?.substring(0, 50));

    try {
      // Get the DM document to find participants
      const dmDoc = await db.collection('dms').doc(dmId).get();
      if (!dmDoc.exists) {
        console.log('DM document not found');
        return;
      }

      const dmData = dmDoc.data();
      // Find the recipient (the other participant)
      const recipientId = dmData.participants?.find((id) => id !== message.senderId);

      if (!recipientId) {
        console.log('No recipient found');
        return;
      }

      // Get recipient's push token
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      if (!recipientDoc.exists) {
        console.log('Recipient user not found');
        return;
      }

      const recipientData = recipientDoc.data();
      if (!recipientData.pushToken) {
        console.log('Recipient has no push token');
        return;
      }

      // Send notification
      const notification = {
        notification: {
          title: message.sender || 'New Message',
          body: message.text?.substring(0, 100) || 'New message',
        },
        data: {
          type: 'dm',
          dmId: dmId,
          messageId: event.params.messageId,
          sender: message.sender || '',
          senderId: message.senderId || '',
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              'mutable-content': 1,
            },
          },
        },
        token: recipientData.pushToken,
      };

      const response = await getMessaging().send(notification);
      console.log('DM notification sent:', response);
    } catch (error) {
      console.error('Error sending DM notification:', error);
    }
  }
);
