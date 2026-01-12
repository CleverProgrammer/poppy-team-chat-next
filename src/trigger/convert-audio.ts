import { logger, task } from "@trigger.dev/sdk/v3";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export const convertAudioTask = task({
  id: "convert-caf-to-mp3",
  maxDuration: 120, // 2 minutes max
  run: async (payload: {
    audioUrl: string;
    userId: string;
    messageId: string;
    chatId: string;
    chatType: string;
    audioIndex: number;
    callbackUrl: string; // The app URL to call back to (passed by triggering app)
  }) => {
    const { audioUrl, userId, messageId, chatId, chatType, audioIndex, callbackUrl } = payload;

    logger.info("Starting CAF to MP3 conversion", { messageId, audioUrl });

    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${messageId}_${audioIndex}_input.caf`);
    const outputPath = path.join(tempDir, `${messageId}_${audioIndex}_output.mp3`);

    try {
      // 1. Download the CAF file
      logger.info("Downloading CAF file...");
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(inputPath, Buffer.from(buffer));

      // 2. Convert to MP3 using FFmpeg
      logger.info("Converting to MP3...");
      await execAsync(`ffmpeg -i "${inputPath}" -acodec libmp3lame -q:a 2 "${outputPath}"`);

      // 3. Read the converted file
      const mp3Buffer = fs.readFileSync(outputPath);
      const mp3Base64 = mp3Buffer.toString("base64");

      // 4. Upload to Firebase Storage via API endpoint (using callback URL from payload)
      logger.info("Uploading MP3 to Firebase via API...", { callbackUrl });
      const uploadResponse = await fetch(`${callbackUrl}/api/trigger/upload-converted-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trigger-internal-api-key": process.env.TRIGGER_INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          mp3Base64,
          userId,
          messageId,
          chatId,
          chatType,
          audioIndex,
        }),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload converted audio: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      const mp3Url = uploadData.mp3Url;

      logger.info("MP3 uploaded and message updated!", { mp3Url });

      // 6. Cleanup temp files
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      logger.info("Conversion complete!", { messageId });

      return {
        success: true,
        messageId,
        audioIndex,
        mp3Url,
      };
    } catch (error) {
      logger.error("Conversion failed", { error });
      // Cleanup on error
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      throw error;
    }
  },
});

