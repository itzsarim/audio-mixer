import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { storage } from "./storage";
import { insertAudioFileSchema, processAudioSchema } from "@shared/schema";
import { z } from "zod";

// Setup multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file extension as primary filter
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".mp3", ".wav"];
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP3 and WAV files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload audio file
  app.post("/api/upload", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Get audio metadata using ffprobe
      const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(req.file!.path, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata.format.duration || 0);
        });
      });

      // Validate duration (max 60 minutes)
      if (duration > 3600) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Audio file too long (max 60 minutes)" });
      }

      const audioFile = await storage.createAudioFile({
        filename: req.file.filename,
        originalName: req.file.originalname,
        duration,
        format: path.extname(req.file.originalname).toLowerCase(),
      });

      res.json(audioFile);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Get audio file info
  app.get("/api/audio/:id", async (req, res) => {
    try {
      const audioFile = await storage.getAudioFile(req.params.id);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      res.json(audioFile);
    } catch (error) {
      console.error("Get audio error:", error);
      res.status(500).json({ message: "Failed to get audio file" });
    }
  });

  // Serve audio files
  app.get("/api/audio/:id/file", async (req, res) => {
    try {
      const audioFile = await storage.getAudioFile(req.params.id);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const filePath = path.join("uploads", audioFile.filename);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error("Serve audio error:", error);
      res.status(500).json({ message: "Failed to serve audio file" });
    }
  });

  // Process audio (cut and mix)
  app.post("/api/process", async (req, res) => {
    try {
      const validatedData = processAudioSchema.parse(req.body);
      const { audioFileId, segments, outputMode, crossfadeDuration } = validatedData;

      const audioFile = await storage.getAudioFile(audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Validate segments are within audio duration
      const maxTime = Math.max(...segments.map(s => s.endTime));
      if (maxTime > audioFile.duration) {
        return res.status(400).json({ message: "Segment end time exceeds audio duration" });
      }

      // Create processing job
      const job = await storage.createProcessingJob({
        audioFileId,
        outputMode,
        crossfadeDuration: outputMode === "crossfade" ? crossfadeDuration || 1.0 : null,
        status: "pending",
        outputFilename: null,
      });

      // Start processing asynchronously
      processAudioAsync(job.id, audioFile, segments, outputMode, crossfadeDuration || 1.0);

      res.json({ jobId: job.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Process audio error:", error);
      res.status(500).json({ message: "Failed to start processing" });
    }
  });

  // Get processing job status
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getProcessingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Get job error:", error);
      res.status(500).json({ message: "Failed to get job status" });
    }
  });

  // Download processed audio
  app.get("/api/jobs/:id/download", async (req, res) => {
    try {
      const job = await storage.getProcessingJob(req.params.id);
      if (!job || job.status !== "completed" || !job.outputFilename) {
        return res.status(404).json({ message: "Processed file not found" });
      }

      const filePath = path.join("outputs", job.outputFilename);
      res.download(filePath, `mixed-audio-${job.id}.mp3`);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processAudioAsync(
  jobId: string,
  audioFile: any,
  segments: Array<{ startTime: number; endTime: number }>,
  outputMode: string,
  crossfadeDuration: number
) {
  try {
    await storage.updateProcessingJobStatus(jobId, "processing");

    const inputPath = path.join("uploads", audioFile.filename);
    const outputDir = "outputs";
    const outputFilename = `processed-${jobId}.mp3`;
    const outputPath = path.join(outputDir, outputFilename);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    if (segments.length === 1) {
      // Single segment - simple cut
      const segment = segments[0];
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(segment.startTime)
          .setDuration(segment.endTime - segment.startTime)
          .output(outputPath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });
    } else {
      // Multiple segments - need to cut and concatenate
      const tempDir = `temp-${jobId}`;
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Cut individual segments
        const segmentFiles: string[] = [];
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const segmentPath = path.join(tempDir, `segment-${i}.mp3`);
          
          await new Promise<void>((resolve, reject) => {
            ffmpeg(inputPath)
              .setStartTime(segment.startTime)
              .setDuration(segment.endTime - segment.startTime)
              .output(segmentPath)
              .on("end", resolve)
              .on("error", reject)
              .run();
          });
          
          segmentFiles.push(segmentPath);
        }

        // Concatenate segments
        if (outputMode === "direct") {
          // Direct concatenation
          const command = ffmpeg();
          segmentFiles.forEach(file => command.input(file));
          
          await new Promise<void>((resolve, reject) => {
            command
              .complexFilter([
                segmentFiles.map((_, i) => `[${i}:a]`).join("") + `concat=n=${segmentFiles.length}:v=0:a=1[out]`
              ])
              .outputOptions(["-map", "[out]"])
              .output(outputPath)
              .on("end", resolve)
              .on("error", reject)
              .run();
          });
        } else {
          // Crossfade concatenation
          const command = ffmpeg();
          segmentFiles.forEach(file => command.input(file));
          
          // Build crossfade filter chain
          let filterChain = "";
          for (let i = 0; i < segmentFiles.length - 1; i++) {
            if (i === 0) {
              filterChain = `[0:a][1:a]acrossfade=d=${crossfadeDuration}[a01];`;
            } else {
              filterChain += `[a0${i}][${i + 1}:a]acrossfade=d=${crossfadeDuration}[a0${i + 1}];`;
            }
          }
          
          await new Promise<void>((resolve, reject) => {
            command
              .complexFilter(filterChain.slice(0, -1)) // Remove last semicolon
              .outputOptions(["-map", `[a0${segmentFiles.length - 1}]`])
              .output(outputPath)
              .on("end", resolve)
              .on("error", reject)
              .run();
          });
        }
      } finally {
        // Clean up temp files
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }

    await storage.updateProcessingJobStatus(jobId, "completed", outputFilename);
  } catch (error) {
    console.error("Processing error:", error);
    await storage.updateProcessingJobStatus(jobId, "failed");
  }
}
