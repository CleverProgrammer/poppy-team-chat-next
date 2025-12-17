const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// NUCLEAR OPTION: Use explicit service account credentials with explicit project ID
const serviceAccount = require('./service-account.json');
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});
console.log('Firebase Admin initialized with explicit credentials for project:', serviceAccount.project_id);

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
    const { dmId, messageId } = event.params;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔔 [DM NOTIFICATION] NEW MESSAGE DETECTED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📨 DM ID: ${dmId}`);
    console.log(`📝 Message ID: ${messageId}`);
    console.log(`👤 Sender: ${message.sender} (${message.senderId})`);
    console.log(`💬 Text: "${message.text?.substring(0, 50)}..."`);
    console.log('───────────────────────────────────────────────────────────');

    try {
      // DM ID format is "{userId1}_{userId2}" (sorted alphabetically)
      const participants = dmId.split('_');
      console.log(`👥 Participants extracted: [${participants.join(', ')}]`);

      if (participants.length !== 2) {
        console.log('❌ FAILED: Invalid DM ID format (expected 2 participants)');
        return;
      }

      // Find the recipient (the other participant)
      const recipientId = participants.find((id) => id !== message.senderId);
      console.log(`🎯 Recipient ID: ${recipientId}`);

      if (!recipientId) {
        console.log('❌ FAILED: No recipient found - sender may not be in participants');
        return;
      }

      // Get recipient's push token
      console.log(`📖 Looking up recipient in Firestore: users/${recipientId}`);
      const recipientDoc = await db.collection('users').doc(recipientId).get();

      if (!recipientDoc.exists) {
        console.log('❌ FAILED: Recipient user document not found in Firestore');
        return;
      }

      const recipientData = recipientDoc.data();
      console.log(`✅ Recipient found: ${recipientData.name || recipientData.email || 'Unknown'}`);

      if (!recipientData.pushToken) {
        console.log('❌ FAILED: Recipient has no pushToken in their user document');
        return;
      }

      console.log(`🔑 Push token found: ${recipientData.pushToken.substring(0, 30)}...`);
      console.log('───────────────────────────────────────────────────────────');
      console.log('📤 SENDING PUSH NOTIFICATION TO FCM...');

      // Send notification
      const notification = {
        notification: {
          title: message.sender || 'New Message',
          body: message.text?.substring(0, 100) || 'New message',
        },
        data: {
          type: 'dm',
          dmId: dmId,
          messageId: messageId,
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

      console.log('📦 Notification payload:', JSON.stringify(notification, null, 2));

      const response = await getMessaging().send(notification);

      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ SUCCESS! NOTIFICATION SENT!');
      console.log(`📬 FCM Response: ${response}`);
      console.log('═══════════════════════════════════════════════════════════');
    } catch (error) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('❌ ERROR SENDING NOTIFICATION');
      console.log(`🚨 Error Code: ${error.code || 'unknown'}`);
      console.log(`🚨 Error Message: ${error.message}`);
      console.log('🚨 Full Error:', JSON.stringify(error, null, 2));
      console.log('═══════════════════════════════════════════════════════════');
    }
  }
);
