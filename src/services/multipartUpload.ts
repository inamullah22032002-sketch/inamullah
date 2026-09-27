import { api } from './api';
import { UploadStatus } from '../types';

export interface MultipartUploadOptions {
  file: File;
  movieId?: string;
  chunkSize?: number; // default 50 MiB
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
  uploadStrategy: 'direct-single' | 'direct-multipart';
  errorMessage?: string;
}

// 50 MiB application threshold: Small files (<= 50 MiB, e.g. 6.4 MB) use direct PutObject.
// Large files (> 50 MiB) use R2 multipart upload with 50 MiB parts.
const SINGLE_UPLOAD_THRESHOLD = 50 * 1024 * 1024;
const DEFAULT_PART_SIZE = 50 * 1024 * 1024;

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown-host';
  }
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
  private uploadStrategy: 'direct-single' | 'direct-multipart' = 'direct-single';

  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private startTime: number = 0;
  private queue: number[] = [];

  constructor(options: MultipartUploadOptions) {
    this.file = options.file;
    this.movieId = options.movieId;
    this.chunkSize = options.chunkSize || DEFAULT_PART_SIZE;
    this.concurrency = options.concurrency || 2;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
    this.onComplete = options.onComplete;

    this.uploadStrategy = this.file.size <= SINGLE_UPLOAD_THRESHOLD ? 'direct-single' : 'direct-multipart';
    this.totalParts = this.uploadStrategy === 'direct-single' ? 1 : Math.max(1, Math.ceil(this.file.size / this.chunkSize));
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

      if (this.uploadStrategy === 'direct-single') {
        // Direct Small-File Upload: 100% direct Browser -> Cloudflare R2 PutObject
        await this.handleDirectSingleUpload();
      } else {
        // Direct Multipart Upload: 100% direct Browser -> Cloudflare R2 UploadPart
        await this.handleDirectMultipartUpload();
      }
    } catch (err: any) {
      this.status = 'FAILED';
      this.updateProgress(err.message);
      if (this.onError) this.onError(err);
    }
  }

  /**
   * DIRECT SMALL-FILE UPLOAD FLOW (Files <= 50 MiB, such as 6.4 MB test videos)
   * 1. Send small JSON to Netlify API: POST /api/admin/uploads/presign
   * 2. Receive genuine Cloudflare R2 S3 Presigned PutObject URL
   * 3. Upload raw Blob directly to Cloudflare R2 via HTTP PUT
   * 4. Send small JSON to Netlify API: POST /api/admin/uploads/complete-single
   * NO VIDEO BYTES EVER TOUCH NETLIFY/EXPRESS!
   */
  private async handleDirectSingleUpload() {
    // 1. Request presigned PutObject URL (small JSON metadata only)
    const presignRes = await api.admin.presignSingle({
      filename: this.file.name,
      size: this.file.size,
      contentType: this.file.type || 'video/mp4',
      movieId: this.movieId,
    });

    const presignedUrl = presignRes.url || presignRes.presignedUrl;
    this.objectKey = presignRes.objectKey;

    // Sanity check: Ensure URL points directly to Cloudflare R2, never Netlify or proxy
    const targetHost = extractHostname(presignedUrl);
    if (presignedUrl.startsWith('/') || targetHost.includes('netlify.app')) {
      throw new Error(
        `INVALID_PRESIGNED_URL: Presigned URL points to '${targetHost}' instead of Cloudflare R2. Server credentials must be configured.`
      );
    }

    this.status = 'UPLOADING';
    this.updateProgress();

    // 2. Direct Browser -> Cloudflare R2 streaming upload
    let response: Response;
    try {
      response = await fetch(presignedUrl, {
        method: 'PUT',
        body: this.file, // Raw Blob. No FormData. No base64. No JSON wrapping.
        headers: {
          'Content-Type': this.file.type || 'video/mp4',
        },
      });
    } catch (netErr: any) {
      console.error('[Upload Debug] Network failure connecting directly to R2:', {
        targetHost,
        error: netErr.message,
      });
      throw new Error(`Direct connection to Cloudflare R2 failed (${netErr.message}). Check network and bucket CORS.`);
    }

    // Diagnostic logging without exposing secrets or signed parameters
    if (!response.ok) {
      const respText = await response.text().catch(() => '');
      console.error('[Upload Debug] Direct R2 PutObject rejected:', {
        status: response.status,
        targetHost,
        contentType: response.headers.get('content-type'),
        safeBody: respText.slice(0, 300),
      });

      if (response.status === 413) {
        throw new Error(
          `UPLOAD_TARGET_REJECTED_FILE_SIZE: HTTP 413 from host '${targetHost}'. Ensure direct Cloudflare R2 upload is active.`
        );
      }

      throw new Error(`Cloudflare R2 rejected upload with HTTP ${response.status}: ${respText.slice(0, 150) || response.statusText}`);
    }

    // 3. Mark progress 100%
    this.uploadedBytesPerPart.set(1, this.file.size);
    this.completedParts.set(1, 'single-put-etag');
    this.status = 'COMPLETING';
    this.updateProgress();

    // 4. Send small JSON completion notification to backend
    const completeRes = await api.admin.completeSingle({
      objectKey: this.objectKey,
      filename: this.file.name,
      size: this.file.size,
      mimeType: this.file.type || 'video/mp4',
      movieId: this.movieId,
    });

    this.status = 'COMPLETED';
    this.updateProgress();

    if (this.onComplete) {
      this.onComplete({
        publicUrl: completeRes.publicUrl || presignRes.publicUrl,
        objectKey: this.objectKey,
      });
    }
  }

  /**
   * DIRECT MULTIPART UPLOAD FLOW (Files > 50 MiB)
   * 1. Send small JSON to Netlify API: POST /api/admin/uploads/multipart/initiate
   * 2. For each 50 MiB part, request genuine R2 presigned URL: POST /api/admin/uploads/multipart/sign
   * 3. Upload raw chunk directly: Browser -> Cloudflare R2 via HTTP PUT
   * 4. Capture ETag from Cloudflare R2 response headers
   * 5. Send small JSON to Netlify API: POST /api/admin/uploads/multipart/complete
   */
  private async handleDirectMultipartUpload() {
    const initRes = await api.admin.initiateMultipart({
      filename: this.file.name,
      size: this.file.size,
      mimeType: this.file.type || 'video/mp4',
      movieId: this.movieId,
    });

    this.uploadId = initRes.uploadId;
    this.objectKey = initRes.objectKey;
    if (initRes.partSize) {
      this.chunkSize = initRes.partSize;
      this.totalParts = Math.max(1, Math.ceil(this.file.size / this.chunkSize));
    }

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
    if (this.uploadStrategy === 'direct-single') {
      await this.start();
    } else {
      await this.processQueue();
    }
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
        await this.finalizeMultipartUpload();
      }
    } catch (err: any) {
      if (!this.isCancelled) {
        this.status = 'FAILED';
        this.updateProgress(err.message);
        if (this.onError) this.onError(err);
      }
    }
  }

  /**
   * Retry failed part: requests a fresh presigned URL and uploads directly to R2
   */
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
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  private async uploadSinglePart(partNumber: number): Promise<void> {
    const startByte = (partNumber - 1) * this.chunkSize;
    const endByte = Math.min(this.file.size, startByte + this.chunkSize);
    const chunk = this.file.slice(startByte, endByte);

    // Request genuine Cloudflare R2 Presigned UploadPart URL (Small JSON only)
    const signRes = await api.admin.signMultipartPart({
      uploadId: this.uploadId!,
      objectKey: this.objectKey!,
      partNumber,
    });

    const presignedUrl = signRes.url || signRes.presignedUrl;
    const targetHost = extractHostname(presignedUrl);

    // Sanity check: verify URL is genuine Cloudflare R2 and not proxied through Netlify
    if (presignedUrl.startsWith('/') || targetHost.includes('netlify.app')) {
      throw new Error(
        `INVALID_PRESIGNED_URL: Part ${partNumber} received local proxy URL (${targetHost}) instead of Cloudflare R2.`
      );
    }

    // Direct Browser -> Cloudflare R2 streaming upload
    // RAW BLOB ONLY: No FormData, no base64, no JSON wrapping
    let response: Response;
    try {
      response = await fetch(presignedUrl, {
        method: 'PUT',
        body: chunk,
      });
    } catch (netErr: any) {
      console.error(`[Upload Debug] Direct R2 PUT part ${partNumber} network failure:`, {
        targetHost,
        partNumber,
        error: netErr.message,
      });
      throw new Error(`Direct connection to Cloudflare R2 failed for part ${partNumber} (${netErr.message})`);
    }

    if (!response.ok) {
      const respText = await response.text().catch(() => '');
      console.error(`[Upload Debug] Direct R2 PUT part ${partNumber} rejected:`, {
        status: response.status,
        targetHost,
        partNumber,
        contentType: response.headers.get('content-type'),
        safeBody: respText.slice(0, 300),
      });

      if (response.status === 413) {
        throw new Error(
          `UPLOAD_TARGET_REJECTED_FILE_SIZE: HTTP 413 from host '${targetHost}' when uploading part ${partNumber}. Verify direct Cloudflare R2 routing.`
        );
      }

      throw new Error(`HTTP ${response.status} when uploading part ${partNumber}: ${respText.slice(0, 150) || response.statusText}`);
    }

    // Extract ETag (R2 CORS must expose ETag header)
    const etag = response.headers.get('ETag') || response.headers.get('etag');
    if (!etag) {
      throw new Error(
        `R2_UPLOAD_ETAG_MISSING: Cloudflare R2 did not return an ETag header for part ${partNumber}. Please verify your R2 bucket CORS configuration exposes the 'ETag' header.`
      );
    }

    this.completedParts.set(partNumber, etag.replace(/"/g, ''));
    this.uploadedBytesPerPart.set(partNumber, chunk.size);
    this.updateProgress();
  }

  private async finalizeMultipartUpload() {
    this.status = 'COMPLETING';
    this.updateProgress();

    const parts = Array.from(this.completedParts.entries()).map(([PartNumber, ETag]) => ({
      PartNumber,
      ETag,
    }));

    // Small JSON only. No video bytes included.
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
        uploadStrategy: this.uploadStrategy,
        errorMessage,
      });
    }
  }
}
