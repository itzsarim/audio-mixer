import type { VercelRequest, VercelResponse } from "@vercel/node";
import Busboy from "busboy";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import fs from "fs/promises";
import path from "path";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
if (ffprobeStatic?.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

function parseMultipart(req: VercelRequest): Promise<{ file: Buffer; filename: string; fields: Record<string, string> }>{
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers as any });
    const fileBufferChunks: Buffer[] = [];
    let filename = "upload.bin";
    const fields: Record<string, string> = {};

    busboy.on("file", (_name, file, info) => {
      filename = info.filename || filename;
      file.on("data", (data: Buffer) => fileBufferChunks.push(data));
      file.on("limit", () => reject(new Error("File too large")));
      file.on("error", reject);
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", () => {
      resolve({ file: Buffer.concat(fileBufferChunks), filename, fields });
    });

    busboy.on("error", reject);

    // Vercel Node API provides an IncomingMessage stream; pipe it into busboy
    (req as any).pipe(busboy);
  });
}

function parseMarkers(raw: string | undefined): Array<{ timestamp: number; order: number }>{
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((m) => ({ timestamp: Number(m.timestamp), order: Number(m.order) }));
    }
    return [];
  } catch {
    return [];
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { file, filename, fields } = await parseMultipart(req);

    const ext = path.extname(filename).toLowerCase();
    if (![".mp3", ".wav"].includes(ext)) {
      return res.status(400).json({ message: "Only MP3 and WAV files are allowed" });
    }

    const markers = parseMarkers(fields.markers);
    const outputMode = fields.outputMode === "direct" ? "direct" : "crossfade";
    const crossfadeDuration = Math.max(0.1, Math.min(10, Number(fields.crossfadeDuration ?? 1.0)));

    // Temp files for ffmpeg
    const tmpDir = path.join("/tmp", `am-${Date.now()}-${Math.random()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, `input${ext || ".mp3"}`);
    await fs.writeFile(inputPath, file);

    // Build segments from markers pairs
    const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
    if (sortedMarkers.length % 2 !== 0) {
      return res.status(400).json({ message: "Even number of markers required." });
    }

    const segments: Array<{ startTime: number; endTime: number }> = [];
    for (let i = 0; i < sortedMarkers.length; i += 2) {
      const start = sortedMarkers[i];
      const end = sortedMarkers[i + 1];
      if (start && end && start.timestamp < end.timestamp) {
        segments.push({ startTime: start.timestamp, endTime: end.timestamp });
      }
    }

    const outPath = path.join(tmpDir, `out.mp3`);

    if (segments.length <= 1) {
      const seg = segments[0] ?? { startTime: 0, endTime: 60 };
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(seg.startTime)
          .setDuration(seg.endTime - seg.startTime)
          .output(outPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
    } else {
      const segmentFiles: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segPath = path.join(tmpDir, `segment-${i}.mp3`);
        segmentFiles.push(segPath);
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(seg.startTime)
            .setDuration(seg.endTime - seg.startTime)
            .output(segPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
      }

      if (outputMode === "direct") {
        const command = ffmpeg();
        segmentFiles.forEach((f) => command.input(f));
        await new Promise<void>((resolve, reject) => {
          command
            .complexFilter([
              segmentFiles.map((_, i) => `[${i}:a]`).join("") + `concat=n=${segmentFiles.length}:v=0:a=1[out]`,
            ])
            .outputOptions(["-map", "[out]"])
            .output(outPath)
            .on("end", () => resolve())
            .on("error", (err) => reject(err))
            .run();
        });
      } else {
        const command = ffmpeg();
        segmentFiles.forEach((f) => command.input(f));
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
    }

    const data = await fs.readFile(outPath);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", data.length.toString());
    res.send(data);

    // Cleanup best-effort
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: e?.message || "Processing failed" });
  }
}
