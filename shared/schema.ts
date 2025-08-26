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

export const markers = pgTable("markers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  audioFileId: varchar("audio_file_id").notNull(),
  timestamp: real("timestamp").notNull(),
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

export const insertMarkerSchema = createInsertSchema(markers).omit({
  id: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Validation schemas
export const markerSchema = z.object({
  timestamp: z.number().min(0, "Timestamp must be non-negative"),
  order: z.number().int().min(0),
});

export const markerListSchema = z.array(markerSchema)
  .min(2, "At least two markers are required")
  .refine(markers => {
    // Check markers are in ascending order by timestamp
    const sorted = [...markers].sort((a, b) => a.timestamp - b.timestamp);
    return markers.every((marker, index) => marker.timestamp === sorted[index].timestamp);
  }, {
    message: "Markers must be in ascending order by timestamp",
  });

export const processAudioSchema = z.object({
  audioFileId: z.string(),
  markers: markerListSchema,
  outputMode: z.enum(["direct", "crossfade"]),
  crossfadeDuration: z.number().min(0.1).max(5).optional(),
});

export const previewAudioSchema = z.object({
  audioFileId: z.string(),
  markers: markerListSchema,
  crossfadeDuration: z.number().min(0.1).max(5).default(1.0),
});

export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertMarker = z.infer<typeof insertMarkerSchema>;
export type Marker = typeof markers.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type ProcessAudioRequest = z.infer<typeof processAudioSchema>;
export type PreviewAudioRequest = z.infer<typeof previewAudioSchema>;
