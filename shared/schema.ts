import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audioFiles = pgTable("audio_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  duration: real("duration").notNull(),
  format: text("format").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const segments = pgTable("segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  audioFileId: varchar("audio_file_id").notNull(),
  startTime: real("start_time").notNull(),
  endTime: real("end_time").notNull(),
  order: integer("order").notNull(),
});

export const processingJobs = pgTable("processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  audioFileId: varchar("audio_file_id").notNull(),
  outputMode: text("output_mode").notNull(), // 'direct' or 'crossfade'
  crossfadeDuration: real("crossfade_duration"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed'
  outputFilename: text("output_filename"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAudioFileSchema = createInsertSchema(audioFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertSegmentSchema = createInsertSchema(segments).omit({
  id: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Validation schemas
export const timestampPairSchema = z.object({
  startTime: z.number().min(0, "Start time must be non-negative"),
  endTime: z.number().min(0, "End time must be non-negative"),
}).refine(data => data.startTime < data.endTime, {
  message: "Start time must be less than end time",
});

export const segmentListSchema = z.array(timestampPairSchema)
  .min(1, "At least one segment is required")
  .refine(segments => {
    // Check for overlapping segments
    const sorted = segments.sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endTime > sorted[i + 1].startTime) {
        return false;
      }
    }
    return true;
  }, {
    message: "Segments cannot overlap",
  });

export const processAudioSchema = z.object({
  audioFileId: z.string(),
  segments: segmentListSchema,
  outputMode: z.enum(["direct", "crossfade"]),
  crossfadeDuration: z.number().min(0.1).max(5).optional(),
});

export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Segment = typeof segments.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type ProcessAudioRequest = z.infer<typeof processAudioSchema>;
