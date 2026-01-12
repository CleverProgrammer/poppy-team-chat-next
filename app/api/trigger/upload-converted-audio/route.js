import { NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/app/lib/firebase-admin';

export async function POST(request) {
  try {
    // Authenticate internal request
    const internalApiKey = request.headers.get('x-trigger-internal-api-key');
    if (internalApiKey !== process.env.TRIGGER_INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mp3Base64, userId, messageId, chatId, chatType, audioIndex } = await request.json();

    if (!mp3Base64 || !userId || !messageId || !chatId || !chatType || audioIndex === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert base64 to buffer
    const mp3Buffer = Buffer.from(mp3Base64, 'base64');

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const mp3FileName = `chat-audio/${userId}/${messageId}_${audioIndex}_converted.mp3`;
    const file = bucket.file(mp3FileName);

    await file.save(mp3Buffer, {
      contentType: 'audio/mpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make file public and get URL
    await file.makePublic();
    const mp3Url = `https://storage.googleapis.com/${bucket.name}/${mp3FileName}`;

    // Update Firestore message - determine collection based on chatType
    let collectionName;
    if (chatType === 'dm') {
      collectionName = 'dms';
    } else if (chatType === 'group') {
      collectionName = 'groups';
    } else {
      collectionName = 'channels';
    }
    const messageRef = adminDb.collection(collectionName).doc(chatId).collection('messages').doc(messageId);

    await adminDb.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }

      const currentAudioUrls = messageDoc.data()?.audioUrls || [];

      // Update the specific audio URL at the given index
      currentAudioUrls[audioIndex] = mp3Url;

      transaction.update(messageRef, {
        audioUrls: currentAudioUrls,
      });
    });

    console.log(`✅ Converted audio uploaded and message updated: ${mp3Url}`);

    return NextResponse.json({ success: true, mp3Url });
  } catch (error) {
    console.error('Error uploading converted audio:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

