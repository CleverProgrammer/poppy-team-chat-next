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

    // Get message data for sender info (needed for transcription)
    let senderInfo = null;
    
    await adminDb.runTransaction(async (transaction) => {
      const messageDoc = await transaction.get(messageRef);
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      const currentAudioUrls = messageData?.audioUrls || [];

      // Capture sender info for transcription
      senderInfo = {
        sender: messageData?.sender || messageData?.senderName || 'Unknown',
        senderEmail: messageData?.senderEmail || '',
        senderId: messageData?.senderId || userId,
      };

      // Update the specific audio URL at the given index
      currentAudioUrls[audioIndex] = mp3Url;

      transaction.update(messageRef, {
        audioUrls: currentAudioUrls,
      });
    });

    console.log(`✅ Converted audio uploaded and message updated: ${mp3Url}`);

    // 🎙️ TRIGGER TRANSCRIPTION for the converted audio (fire and forget)
    // This was missing before - iOS audio messages were never getting transcribed!
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3007');
    
    console.log(`🎙️ Triggering transcription for converted audio: ${mp3Url}`);
    
    fetch(`${baseUrl}/api/media/transcribe-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: mp3Url,
        messageId,
        sender: senderInfo?.sender,
        senderEmail: senderInfo?.senderEmail,
        senderId: senderInfo?.senderId,
        enableSpeakerDiarization: true,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.transcription?.text) {
          console.log(`🎙️ iOS audio transcribed: ${data.transcription.text.substring(0, 50)}...`);
          if (data.transcription.tldr) {
            console.log(`✨ TLDR: ${data.transcription.tldr}`);
          }
          
          // Save transcription to Firestore
          messageRef.update({
            transcription: {
              text: data.transcription.text,
              formatted: data.transcription.formatted,
              tldr: data.transcription.tldr || null,
              speakerCount: data.transcription.speakerCount,
              confidence: data.transcription.confidence,
              _cost: data.cost?.amount,
              _durationSeconds: data.audio?.durationSeconds,
            },
          }).catch(err => console.warn('Failed to save iOS transcription to Firestore:', err));
        }
      })
      .catch(err => console.error('iOS audio transcription failed:', err));

    return NextResponse.json({ success: true, mp3Url });
  } catch (error) {
    console.error('Error uploading converted audio:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

