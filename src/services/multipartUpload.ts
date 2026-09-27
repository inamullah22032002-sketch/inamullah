import { api, ApiError } from './api';
import { UploadStatus } from '../types';

export interface MultipartUploadOptions {
  file: File;
  movieId?: string;
  chunkSize?: number; // default 20MB
  concurrency?: number; // default 2
  onProgress?: (progress: UploadProgressState) => void;
  onError?: (err: Error) => void;
  onComplete?: (result: { publicUrl: string; objectKey: string }) => void;
}

export interface UploadProgressState {
  status: UploadStatus;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  percentage: number;
  currentPart: number;
  totalParts: number;
  speedBps: number;
  timeRemainingSeconds: number;
  errorMessage?: string;
}

export class MultipartUploadManager {
  private file: File;
  private movieId?: string;
  private chunkSize: number;
  private concurrency: number;
  private onProgress?: (progress: UploadProgressState) => void;
  private onError?: (err: Error) => void;
  private onComplete?: (result: { publicUrl: string; objectKey: string }) => void;

  private uploadId: string | null = null;
  private objectKey: string | null = null;
  private status: UploadStatus = 'IDLE';
  private totalParts: number = 0;
  private completedParts: Map<number, string> = new Map(); // PartNumber -> ETag
  private uploadedBytesPerPart: Map<number, number> = new Map();

  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private startTime: number = 0;
  private activeUploads: number = 0;
  private queue: number[] = [];

  constructor(options: MultipartUploadOptions) {
    this.file = options.file;
    this.movieId = options.movieId;
    this.chunkSize = options.chunkSize || 20 * 1024 * 1024; // 20 MB chunks
    this.concurrency = options.concurrency || 2;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
    this.onComplete = options.onComplete;

    this.totalParts = Math.max(1, Math.ceil(this.file.size / this.chunkSize));
  }

  public getStatus(): UploadStatus {
    return this.status;
  }

  public async start() {
    try {
      this.status = 'INITIALIZING';
      this.isPaused = false;
      this.isCancelled = false;
      this.startTime = Date.now();
      this.updateProgress();

      // Step 2 & 4: Initiate multipart upload on server
      const initRes = await api.admin.initiateMultipart({
        filename: this.file.name,
        size: this.file.size,
        mimeType: this.file.type || 'video/mp4',
        movieId: this.movieId,
      });

      this.uploadId = initRes.uploadId;
      this.objectKey = initRes.objectKey;
      this.status = 'UPLOADING';
      this.updateProgress();

      // Populate queue of part numbers (1-indexed)
      this.queue = [];
      for (let i = 1; i <= this.totalParts; i++) {
        if (!this.completedParts.has(i)) {
          this.queue.push(i);
        }
      }

      await this.processQueue();
    } catch (err: any) {
      this.status = 'FAILED';
      this.updateProgress(err.message);
      if (this.onError) this.onError(err);
    }
  }

  public pause() {
    this.isPaused = true;
    this.status = 'PAUSED';
    this.updateProgress();
  }

  public async resume() {
    if (this.status !== 'PAUSED') return;
    this.isPaused = false;
    this.status = 'UPLOADING';
    this.updateProgress();
    await this.processQueue();
  }

  public async cancel() {
    this.isCancelled = true;
    this.isPaused = false;
    this.status = 'CANCELLED';
    this.updateProgress();

    if (this.uploadId && this.objectKey) {
      try {
        await api.admin.abortMultipart({
          uploadId: this.uploadId,
          objectKey: this.objectKey,
        });
      } catch (e) {
        console.warn('Failed to abort multipart upload:', e);
      }
    }
  }

  public async retry() {
    if (this.status === 'FAILED') {
      this.status = 'RETRYING';
      this.updateProgress();
      await this.start();
    }
  }

  private async processQueue() {
    const workers: Promise<void>[] = [];

    const spawnWorker = async (): Promise<void> => {
      while (this.queue.length > 0 && !this.isPaused && !this.isCancelled) {
        const partNumber = this.queue.shift();
        if (!partNumber) break;

        try {
          await this.uploadPartWithRetry(partNumber, 3);
        } catch (err: any) {
          // If a part failed after all retries
          this.queue.unshift(partNumber);
          throw err;
        }
      }
    };

    const workerCount = Math.min(this.concurrency, this.queue.length || 1);
    for (let i = 0; i < workerCount; i++) {
      workers.push(spawnWorker());
    }

    try {
      await Promise.all(workers);

      if (this.isPaused || this.isCancelled) {
        return;
      }

      // Check if all parts completed
      if (this.completedParts.size === this.totalParts) {
        await this.finalizeUpload();
      }
    } catch (err: any) {
      if (!this.isCancelled) {
        this.status = 'FAILED';
        this.updateProgress(err.message);
        if (this.onError) this.onError(err);
      }
    }
  }

  private async uploadPartWithRetry(partNumber: number, maxRetries: number = 3): Promise<void> {
    let attempt = 0;
    while (attempt < maxRetries) {
      if (this.isPaused || this.isCancelled) return;

      try {
        await this.uploadSinglePart(partNumber);
        return; // Success
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error(`Part ${partNumber} upload failed after ${maxRetries} attempts: ${err.message}`);
        }
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }

  private async uploadSinglePart(partNumber: number): Promise<void> {
    const startByte = (partNumber - 1) * this.chunkSize;
    const endByte = Math.min(this.file.size, startByte + this.chunkSize);
    const chunk = this.file.slice(startByte, endByte);

    // Step 7: Get presigned/authorized signature
    const signRes = await api.admin.signMultipartPart({
      uploadId: this.uploadId!,
      objectKey: this.objectKey!,
      partNumber,
    });

    const presignedUrl = signRes.presignedUrl;

    // Step 8: Upload chunk DIRECTLY to R2 (or fallback receiver in dev)
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when uploading part ${partNumber}`);
    }

    // Step 10: Extract ETag (R2 CORS must expose ETag)
    let etag = response.headers.get('ETag') || response.headers.get('etag');
    if (!etag) {
      // In local dev emulation without live S3, generate deterministic tag
      etag = `"${partNumber}-${chunk.size}"`;
    }

    this.completedParts.set(partNumber, etag.replace(/"/g, ''));
    this.uploadedBytesPerPart.set(partNumber, chunk.size);
    this.updateProgress();
  }

  private async finalizeUpload() {
    this.status = 'COMPLETING';
    this.updateProgress();

    const parts = Array.from(this.completedParts.entries()).map(([PartNumber, ETag]) => ({
      PartNumber,
      ETag,
    }));

    const result = await api.admin.completeMultipart({
      uploadId: this.uploadId!,
      objectKey: this.objectKey!,
      parts,
    });

    this.status = 'COMPLETED';
    this.updateProgress();

    if (this.onComplete) {
      this.onComplete(result);
    }
  }

  private updateProgress(errorMessage?: string) {
    let totalUploaded = 0;
    for (const bytes of this.uploadedBytesPerPart.values()) {
      totalUploaded += bytes;
    }
    if (this.status === 'COMPLETED') {
      totalUploaded = this.file.size;
    }

    const elapsedSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);
    const speedBps = totalUploaded / elapsedSeconds;
    const remainingBytes = Math.max(0, this.file.size - totalUploaded);
    const timeRemainingSeconds = speedBps > 0 ? Math.ceil(remainingBytes / speedBps) : 0;
    const percentage = Math.min(100, Math.round((totalUploaded / this.file.size) * 100));

    if (this.onProgress) {
      this.onProgress({
        status: this.status,
        fileName: this.file.name,
        totalBytes: this.file.size,
        uploadedBytes: totalUploaded,
        percentage: this.status === 'COMPLETED' ? 100 : percentage,
        currentPart: this.completedParts.size,
        totalParts: this.totalParts,
        speedBps,
        timeRemainingSeconds,
        errorMessage,
      });
    }
  }
}
