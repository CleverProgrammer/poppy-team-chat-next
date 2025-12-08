import { NextResponse } from 'next/server';
import { identifyKnockUser } from '../../lib/knock';

export async function POST(request) {
  try {
    const user = await request.json();
    console.log('🟢 [API] Received identify-user request for:', user.email);

    await identifyKnockUser(user);
    console.log('🟢 [API] Successfully identified user in Knock');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🔴 [API] Error identifying user:', error);
    return NextResponse.json(
      { error: 'Failed to identify user' },
      { status: 500 }
    );
  }
}
