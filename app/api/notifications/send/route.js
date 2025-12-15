import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { recipientUserId, title, message, data } = await request.json();

    if (!recipientUserId || !message) {
      return NextResponse.json(
        { error: 'recipientUserId and message are required' },
        { status: 400 }
      );
    }

    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      console.error('OneSignal credentials not configured');
      return NextResponse.json(
        { error: 'Notification service not configured' },
        { status: 500 }
      );
    }

    // Send notification via OneSignal REST API
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [recipientUserId],
        headings: { en: title || 'Poppy Chat' },
        contents: { en: message },
        data: data || {},
        web_url: typeof window !== 'undefined' ? window.location.origin : 'https://poppy.chat',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('OneSignal API error:', result);
      return NextResponse.json(
        { error: 'Failed to send notification', details: result },
        { status: response.status }
      );
    }

    console.log('Notification sent successfully:', result);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
