import { type AudioFile, type InsertAudioFile, type ProcessingJob, type InsertProcessingJob } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Audio files
  createAudioFile(audioFile: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: string): Promise<AudioFile | undefined>;
  
  // Processing jobs
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  updateProcessingJobStatus(id: string, status: string, outputFilename?: string): Promise<ProcessingJob | undefined>;
}

export class MemStorage implements IStorage {
  private audioFiles: Map<string, AudioFile>;
  private processingJobs: Map<string, ProcessingJob>;

  constructor() {
    this.audioFiles = new Map();
    this.processingJobs = new Map();
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
      createdAt: new Date(),
      completedAt: null,
    };
    this.processingJobs.set(id, job);
    return job;
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    return this.processingJobs.get(id);
  }

  async updateProcessingJobStatus(id: string, status: string, outputFilename?: string): Promise<ProcessingJob | undefined> {
    const job = this.processingJobs.get(id);
    if (!job) return undefined;

    const updatedJob: ProcessingJob = {
      ...job,
      status,
      outputFilename,
      completedAt: status === "completed" ? new Date() : job.completedAt,
    };
    this.processingJobs.set(id, updatedJob);
    return updatedJob;
  }
}

export const storage = new MemStorage();
