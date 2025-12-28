import { NextResponse } from 'next/server'
import { admin } from '../../../lib/firebase-admin'

// Initialize storage bucket
const storageBucket = admin.storage().bucket('poppy-team-chat.firebasestorage.app')

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const groupId = formData.get('groupId')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!groupId) {
      return NextResponse.json({ error: 'No groupId provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `group-photos/${groupId}/${timestamp}.${extension}`

    // Upload to Firebase Storage
    const fileRef = storageBucket.file(filename)
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          groupId,
          uploadedAt: new Date().toISOString(),
        },
      },
    })

    // Make the file publicly accessible
    await fileRef.makePublic()

    // Get the public URL
    const url = `https://storage.googleapis.com/${storageBucket.name}/${filename}`

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error uploading group photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error.message },
      { status: 500 }
    )
  }
}

