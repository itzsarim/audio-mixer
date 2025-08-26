import { type AudioFile, type InsertAudioFile, type ProcessingJob, type InsertProcessingJob, type Marker, type InsertMarker } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Audio files
  createAudioFile(audioFile: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: string): Promise<AudioFile | undefined>;
  
  // Markers
  createMarkers(audioFileId: string, markers: Array<{ timestamp: number; order: number }>): Promise<Marker[]>;
  getMarkers(audioFileId: string): Promise<Marker[]>;
  updateMarkers(audioFileId: string, markers: Array<{ timestamp: number; order: number }>): Promise<Marker[]>;
  
  // Processing jobs
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  updateProcessingJobStatus(id: string, status: string, outputFilename?: string): Promise<ProcessingJob | undefined>;
}

export class MemStorage implements IStorage {
  private audioFiles: Map<string, AudioFile>;
  private processingJobs: Map<string, ProcessingJob>;
  private markers: Map<string, Marker[]>; // audioFileId -> markers
  private audioFileData: Map<string, Buffer>; // audioFileId -> raw bytes
  private jobOutputs: Map<string, Buffer>; // jobId -> output bytes

  constructor() {
    this.audioFiles = new Map();
    this.processingJobs = new Map();
    this.markers = new Map();
    this.audioFileData = new Map();
    this.jobOutputs = new Map();
  }

  async createAudioFile(insertAudioFile: InsertAudioFile): Promise<AudioFile> {
    const id = randomUUID();
    const audioFile: AudioFile = {
      ...insertAudioFile,
      id,
      uploadedAt: new Date(),
    };
    this.audioFiles.set(id, audioFile);
    return audioFile;
  }

  async getAudioFile(id: string): Promise<AudioFile | undefined> {
    return this.audioFiles.get(id);
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const id = randomUUID();
    const job: ProcessingJob = {
      ...insertJob,
      id,
      crossfadeDuration: insertJob.crossfadeDuration ?? null,
      outputFilename: insertJob.outputFilename ?? null,
      status: insertJob.status ?? "pending",
      createdAt: new Date(),
      completedAt: null,
    };
    this.processingJobs.set(id, job);
    return job;
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    return this.processingJobs.get(id);
  }

  async createMarkers(audioFileId: string, markersData: Array<{ timestamp: number; order: number }>): Promise<Marker[]> {
    const markers: Marker[] = markersData.map(data => ({
      id: randomUUID(),
      audioFileId,
      timestamp: data.timestamp,
      order: data.order,
    }));
    this.markers.set(audioFileId, markers);
    return markers;
  }

  async getMarkers(audioFileId: string): Promise<Marker[]> {
    return this.markers.get(audioFileId) || [];
  }

  async updateMarkers(audioFileId: string, markersData: Array<{ timestamp: number; order: number }>): Promise<Marker[]> {
    const markers: Marker[] = markersData.map(data => ({
      id: randomUUID(),
      audioFileId,
      timestamp: data.timestamp,
      order: data.order,
    }));
    this.markers.set(audioFileId, markers);
    return markers;
  }

  async updateProcessingJobStatus(id: string, status: string, outputFilename?: string): Promise<ProcessingJob | undefined> {
    const job = this.processingJobs.get(id);
    if (!job) return undefined;

    const updatedJob: ProcessingJob = {
      ...job,
      status,
      outputFilename: outputFilename ?? null,
      completedAt: status === "completed" ? new Date() : job.completedAt,
    };
    this.processingJobs.set(id, updatedJob);
    return updatedJob;
  }

  // In-memory bytes management
  setAudioBytes(audioFileId: string, data: Buffer) {
    this.audioFileData.set(audioFileId, data);
  }

  getAudioBytes(audioFileId: string): Buffer | undefined {
    return this.audioFileData.get(audioFileId);
  }

  deleteAudioBytes(audioFileId: string) {
    this.audioFileData.delete(audioFileId);
  }

  setJobOutput(jobId: string, data: Buffer) {
    this.jobOutputs.set(jobId, data);
  }

  getJobOutput(jobId: string): Buffer | undefined {
    return this.jobOutputs.get(jobId);
  }

  deleteJobOutput(jobId: string) {
    this.jobOutputs.delete(jobId);
  }
}

export const storage = new MemStorage();
