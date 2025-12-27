import { NextResponse } from 'next/server';
import ragie from '../../../lib/ragie-client.js';

// Add a message to team-wide AI memory (globally accessible)
// Supports both text messages and images (including multiple images)
export async function POST(request) {
  try {
    const {
      messageId,
      text,
      imageUrl,
      imageUrls, // Support multiple images
      sender,
      senderEmail,
      senderId,
      timestamp
    } = await request.json();

    // Normalize to array of image URLs
    const allImageUrls = imageUrls || (imageUrl ? [imageUrl] : []);
    const hasImages = allImageUrls.length > 0;

    // Must have messageId and either text or images
    if (!messageId || (!text && !hasImages)) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, and either text or imageUrl(s)' },
        { status: 400 }
      );
    }

    // Build metadata for GLOBAL team memory - no permission restrictions
    const metadata = {
      messageId,
      sender: sender || 'Unknown',
      senderEmail: senderEmail || '',
      senderId: senderId || '',
      timestamp: timestamp || new Date().toISOString(),
      chatType: 'team_memory',  // Special type that bypasses all permission filters
      chatId: 'team_memory',    // Global team memory
      isTeamMemory: true        // Flag for easy filtering
    };

    const documents = [];

    // Add each image as a separate document
    for (let i = 0; i < allImageUrls.length; i++) {
      const url = allImageUrls[i];
      const imageMetadata = {
        ...metadata,
        messageId: allImageUrls.length > 1 ? `${messageId}_img${i}` : messageId,
        contentType: 'image',
        imageIndex: i,
        totalImages: allImageUrls.length,
        hasAccompanyingText: !!text,
        imageUrls: allImageUrls, // Include all URLs so search can return them
        imageUrl: url, // Also include this specific image URL
      };

      console.log(`🧠 Team Memory: Adding image ${i + 1}/${allImageUrls.length} from ${sender}`);

      const imageDoc = await ragie.documents.createDocumentFromUrl({
        url: url,
        metadata: imageMetadata
      });
      documents.push({ id: imageDoc.id, type: 'image' });
    }

    // If there's text, create a text document (even if there are also images)
    if (text) {
      const textMetadata = {
        ...metadata,
        contentType: 'text',
        hasAccompanyingImage: hasImages,
        imageCount: allImageUrls.length,
        // Only include imageUrls if there are images (Ragie doesn't accept null values)
        ...(hasImages && { imageUrls: allImageUrls })
      };

      const imageCountText = allImageUrls.length > 1 ? `${allImageUrls.length} images` : 'image';
      const textContent = hasImages
        ? `[Team Memory from ${sender}] (with ${imageCountText}): ${text}`
        : `[Team Memory from ${sender}]: ${text}`;

      console.log(`🧠 Team Memory: Adding text "${text.substring(0, 50)}..." by ${sender}`);

      const textDoc = await ragie.documents.createRaw({
        data: textContent,
        metadata: textMetadata
      });
      documents.push({ id: textDoc.id, type: 'text' });
    }

    console.log(`✅ Team Memory: Added ${documents.length} document(s), IDs: ${documents.map(d => d.id).join(', ')}`);

    // Determine response type
    let type = 'text';
    if (hasImages && text) {
      type = allImageUrls.length > 1 ? 'images+text' : 'image+text';
    } else if (hasImages) {
      type = allImageUrls.length > 1 ? 'images' : 'image';
    }

    return NextResponse.json({
      success: true,
      documents,
      messageId,
      type
    });
  } catch (error) {
    console.error('❌ Team Memory error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}