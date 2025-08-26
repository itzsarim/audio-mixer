import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import ffmpeg from "fluent-ffmpeg";
import { storage } from "./storage";
import { insertAudioFileSchema, processAudioSchema, previewAudioSchema } from "@shared/schema";
import { z } from "zod";

// Setup multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".mp3", ".wav"];
    if (allowedExtensions.includes(fileExtension)) cb(null, true);
    else cb(new Error("Only MP3 and WAV files are allowed"));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload audio file
  app.post("/api/upload", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Get audio metadata using ffprobe from memory by writing to temp file (only for probe)
      // Create a temp file, write buffer, probe, then delete temp file
      const tmpDir = path.join(process.cwd(), "tmp");
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `${Date.now()}-${req.file.originalname}`);
      await fs.writeFile(tmpPath, req.file.buffer);
      const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(tmpPath, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata.format.duration || 0);
        });
      });
      await fs.rm(tmpPath, { force: true });

      // Validate duration (max 60 minutes)
      if (duration > 3600) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Audio file too long (max 60 minutes)" });
      }

      const audioFile = await storage.createAudioFile({
        filename: req.file.originalname,
        originalName: req.file.originalname,
        duration,
        format: path.extname(req.file.originalname).toLowerCase(),
      });

      // store bytes in memory keyed by audio file id
      (storage as any).setAudioBytes(audioFile.id, Buffer.from(req.file.buffer));

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
      const data: Buffer | undefined = (storage as any).getAudioBytes(audioFile.id);
      if (!data) return res.status(404).json({ message: "Audio bytes not found" });
      res.setHeader("Content-Type", audioFile.format === ".wav" ? "audio/wav" : "audio/mpeg");
      res.setHeader("Content-Length", data.length.toString());
      res.send(data);
    } catch (error) {
      console.error("Serve audio error:", error);
      res.status(500).json({ message: "Failed to serve audio file" });
    }
  });

  // Save markers for audio file
  app.post("/api/audio/:id/markers", async (req, res) => {
    try {
      const audioFileId = req.params.id;
      const { markers } = req.body;
      
      const audioFile = await storage.getAudioFile(audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Validate markers are within audio duration
      const invalidMarkers = markers.filter((m: any) => m.timestamp > audioFile.duration);
      if (invalidMarkers.length > 0) {
        return res.status(400).json({ message: "Some markers exceed audio duration" });
      }

      const savedMarkers = await storage.updateMarkers(audioFileId, markers);
      res.json(savedMarkers);
    } catch (error) {
      console.error("Save markers error:", error);
      res.status(500).json({ message: "Failed to save markers" });
    }
  });

  // Get markers for audio file
  app.get("/api/audio/:id/markers", async (req, res) => {
    try {
      const markers = await storage.getMarkers(req.params.id);
      res.json(markers);
    } catch (error) {
      console.error("Get markers error:", error);
      res.status(500).json({ message: "Failed to get markers" });
    }
  });

  // Preview audio with crossfade
  app.post("/api/preview", async (req, res) => {
    try {
      const validatedData = previewAudioSchema.parse(req.body);
      const { audioFileId, markers, crossfadeDuration } = validatedData;

      const audioFile = await storage.getAudioFile(audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Validate markers are within audio duration
      const maxTime = Math.max(...markers.map(m => m.timestamp));
      if (maxTime > audioFile.duration) {
        return res.status(400).json({ message: "Some markers exceed audio duration" });
      }

      // Generate preview buffer from in-memory input
      const inputBuffer: Buffer | undefined = (storage as any).getAudioBytes(audioFileId);
      if (!inputBuffer) return res.status(404).json({ message: "Audio bytes not found" });
      const outputBuffer = await generatePreviewBuffer(inputBuffer, markers, crossfadeDuration);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", outputBuffer.length.toString());
      res.send(outputBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Preview audio error:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // Process audio (cut and mix)
  app.post("/api/process", async (req, res) => {
    try {
      const validatedData = processAudioSchema.parse(req.body);
      const { audioFileId, markers, outputMode, crossfadeDuration } = validatedData;

      const audioFile = await storage.getAudioFile(audioFileId);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Validate markers are within audio duration
      const maxTime = Math.max(...markers.map(m => m.timestamp));
      if (maxTime > audioFile.duration) {
        return res.status(400).json({ message: "Some markers exceed audio duration" });
      }

      // Create processing job
      const job = await storage.createProcessingJob({
        audioFileId,
        outputMode,
        crossfadeDuration: outputMode === "crossfade" ? crossfadeDuration || 1.0 : null,
        status: "pending",
        outputFilename: null,
      });

      // Start processing asynchronously using in-memory buffers
      processAudioAsyncToMemory(job.id, audioFileId, markers, outputMode, crossfadeDuration || 1.0);

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
      if (!job || job.status !== "completed") {
        return res.status(404).json({ message: "Processed file not found" });
      }
      const data: Buffer | undefined = (storage as any).getJobOutput(job.id);
      if (!data) return res.status(404).json({ message: "Output not found" });
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="mixed-audio-${job.id}.mp3"`);
      res.setHeader("Content-Length", data.length.toString());
      res.send(data);
      // Optionally delete output after send
      (storage as any).deleteJobOutput(job.id);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function generatePreviewBuffer(
  inputBuffer: Buffer,
  markers: Array<{ timestamp: number; order: number }>,
  crossfadeDuration: number
): Promise<Buffer> {
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  if (sortedMarkers.length % 2 !== 0) {
    throw new Error("Even number of markers required. Each pair creates one segment.");
  }
  const segments: Array<{ startTime: number; endTime: number }> = [];
  for (let i = 0; i < sortedMarkers.length; i += 2) {
    const startMarker = sortedMarkers[i];
    const endMarker = sortedMarkers[i + 1];
    if (startMarker && endMarker && startMarker.timestamp < endMarker.timestamp) {
      segments.push({ startTime: startMarker.timestamp, endTime: endMarker.timestamp });
    }
  }
  return await processSegmentsToBuffer(inputBuffer, segments, "crossfade", crossfadeDuration);
}

async function processAudioAsyncToMemory(
  jobId: string,
  audioFileId: string,
  markers: Array<{ timestamp: number; order: number }>,
  outputMode: string,
  crossfadeDuration: number
) {
  try {
    await storage.updateProcessingJobStatus(jobId, "processing");

    const inputBuffer: Buffer | undefined = (storage as any).getAudioBytes(audioFileId);
    if (!inputBuffer) throw new Error("Audio bytes not found");

    const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
    
    // Validate even number of markers
    if (sortedMarkers.length % 2 !== 0) {
      throw new Error("Even number of markers required. Each pair creates one segment.");
    }
    
    const segments: Array<{ startTime: number; endTime: number }> = [];
    
    // Create segments from pairs (0&1, 2&3, 4&5, etc.)
    for (let i = 0; i < sortedMarkers.length; i += 2) {
      const startMarker = sortedMarkers[i];
      const endMarker = sortedMarkers[i + 1];
      
      if (startMarker && endMarker && startMarker.timestamp < endMarker.timestamp) {
        segments.push({
          startTime: startMarker.timestamp,
          endTime: endMarker.timestamp,
        });
      }
    }

    const outputBuffer = await processSegmentsToBuffer(inputBuffer, segments, outputMode, crossfadeDuration);
    (storage as any).setJobOutput(jobId, outputBuffer);
    await storage.updateProcessingJobStatus(jobId, "completed");
    // delete input bytes to free memory
    (storage as any).deleteAudioBytes(audioFileId);
  } catch (error) {
    console.error("Processing error:", error);
    await storage.updateProcessingJobStatus(jobId, "failed");
  }
}

async function processSegmentsToBuffer(
  inputBuffer: Buffer,
  segments: Array<{ startTime: number; endTime: number }>,
  outputMode: string,
  crossfadeDuration: number
): Promise<Buffer> {
  // Write input buffer to temp file because ffmpeg CLI operates on files
  const tempRoot = path.join(process.cwd(), "tmp");
  await fs.mkdir(tempRoot, { recursive: true });
  const inputPath = path.join(tempRoot, `in-${Date.now()}-${Math.random()}.mp3`);
  await fs.writeFile(inputPath, inputBuffer);

  const cleanupPaths: string[] = [inputPath];
  try {
    if (segments.length === 1) {
      const segment = segments[0];
      const outPath = path.join(tempRoot, `out-${Date.now()}-${Math.random()}.mp3`);
      cleanupPaths.push(outPath);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(segment.startTime)
          .setDuration(segment.endTime - segment.startTime)
          .output(outPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
      const data = await fs.readFile(outPath);
      return data;
    } else {
      const tempDir = path.join(tempRoot, `segments-${Date.now()}-${Math.random()}`);
      await fs.mkdir(tempDir, { recursive: true });
      cleanupPaths.push(tempDir);
      const segmentFiles: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentPath = path.join(tempDir, `segment-${i}.mp3`);
        segmentFiles.push(segmentPath);
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(segment.startTime)
            .setDuration(segment.endTime - segment.startTime)
            .output(segmentPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
      }

      const outPath = path.join(tempRoot, `out-${Date.now()}-${Math.random()}.mp3`);
      cleanupPaths.push(outPath);
      if (outputMode === "direct") {
        const command = ffmpeg();
        segmentFiles.forEach(file => command.input(file));
        await new Promise<void>((resolve, reject) => {
          command
            .complexFilter([
              segmentFiles.map((_, i) => `[${i}:a]`).join("") + `concat=n=${segmentFiles.length}:v=0:a=1[out]`
            ])
            .outputOptions(["-map", "[out]"])
            .output(outPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
      } else {
        const command = ffmpeg();
        segmentFiles.forEach(file => command.input(file));
        let filterChain = "";
        for (let i = 0; i < segmentFiles.length - 1; i++) {
          if (i === 0) filterChain = `[0:a][1:a]acrossfade=d=${crossfadeDuration}[a01];`;
          else filterChain += `[a0${i}][${i + 1}:a]acrossfade=d=${crossfadeDuration}[a0${i + 1}];`;
        }
        await new Promise<void>((resolve, reject) => {
          command
            .complexFilter(filterChain.slice(0, -1))
            .outputOptions(["-map", `[a0${segmentFiles.length - 1}]`])
            .output(outPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
      }
      const data = await fs.readFile(outPath);
      return data;
    }
  } finally {
    // Cleanup temp files/dirs best-effort
    for (const p of cleanupPaths) {
      try {
        if (p && (await fs.stat(p).then(() => true).catch(() => false))) {
          const stat = await fs.stat(p).catch(() => undefined);
          if (stat && stat.isDirectory()) await fs.rm(p, { recursive: true, force: true });
          else await fs.rm(p, { force: true });
        }
      } catch {}
    }
  }
}
