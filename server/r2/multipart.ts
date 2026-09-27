import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { getR2Client, getR2Config, isR2Configured } from './config';

export interface CompletedPartInput {
  PartNumber: number;
  ETag: string;
}

export async function createMultipartUpload(params: {
  filename: string;
  mimeType: string;
  size: number;
  movieId?: string;
}): Promise<{ uploadId: string; objectKey: string; isDirectR2: boolean }> {
  const config = getR2Config();
  const client = getR2Client();

  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueId = crypto.randomUUID();
  const movieId = params.movieId || 'media';
  const objectKey = `movies/${movieId}/${uniqueId}/${sanitizedFilename}`;

  // If live R2 credentials are configured, initialize direct S3 multipart upload
  if (config && client) {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        ContentType: params.mimeType,
      });

      const response = await client.send(command);
      if (!response.UploadId) {
        throw new Error('No UploadId received from Cloudflare R2');
      }

      return {
        uploadId: response.UploadId,
        objectKey,
        isDirectR2: true,
      };
    } catch (err: any) {
      console.error('R2 CreateMultipartUpload error:', err);
      throw new Error(`UPLOAD_INITIALIZATION_FAILED: ${err.message || 'Could not connect to Cloudflare R2'}`);
    }
  }

  // If R2 is not configured in this environment, return an emulation uploadId so the system stays fully testable
  const fallbackUploadId = 'dev_upl_' + crypto.randomUUID();
  return {
    uploadId: fallbackUploadId,
    objectKey,
    isDirectR2: false,
  };
}

export async function signUploadPart(params: {
  uploadId: string;
  objectKey: string;
  partNumber: number;
}): Promise<{ presignedUrl: string; isDirectR2: boolean }> {
  const config = getR2Config();
  const client = getR2Client();

  if (config && client && !params.uploadId.startsWith('dev_upl_')) {
    try {
      const command = new UploadPartCommand({
        Bucket: config.bucketName,
        Key: params.objectKey,
        UploadId: params.uploadId,
        PartNumber: params.partNumber,
      });

      // Presign for 60 minutes
      const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
      return { presignedUrl, isDirectR2: true };
    } catch (err: any) {
      console.error('R2 signUploadPart error:', err);
      throw new Error(`PART_UPLOAD_FAILED: ${err.message}`);
    }
  }

  // Local/Preview fallback: return backend route for part upload
  const presignedUrl = `/api/admin/uploads/direct-part?uploadId=${encodeURIComponent(params.uploadId)}&partNumber=${params.partNumber}&objectKey=${encodeURIComponent(params.objectKey)}`;
  return { presignedUrl, isDirectR2: false };
}

export async function completeMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
  parts: CompletedPartInput[];
}): Promise<{ publicUrl: string; objectKey: string }> {
  const config = getR2Config();
  const client = getR2Client();

  // Sort parts by PartNumber ascending (S3 requirement)
  const sortedParts = [...params.parts].sort((a, b) => a.PartNumber - b.PartNumber);

  if (config && client && !params.uploadId.startsWith('dev_upl_')) {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: params.objectKey,
        UploadId: params.uploadId,
        MultipartUpload: {
          Parts: sortedParts.map(p => ({
            PartNumber: p.PartNumber,
            ETag: p.ETag.startsWith('"') ? p.ETag : `"${p.ETag}"`,
          })),
        },
      });

      await client.send(command);

      const publicUrl = config.publicUrl
        ? `${config.publicUrl.replace(/\/$/, '')}/${params.objectKey}`
        : `${config.endpoint}/${config.bucketName}/${params.objectKey}`;

      return { publicUrl, objectKey: params.objectKey };
    } catch (err: any) {
      console.error('R2 CompleteMultipartUpload error:', err);
      throw new Error(`MULTIPART_COMPLETE_FAILED: ${err.message}`);
    }
  }

  // Fallback public URL
  const publicUrl = `/api/media/stream/${encodeURIComponent(params.objectKey)}`;
  return { publicUrl, objectKey: params.objectKey };
}

export async function abortMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
}): Promise<void> {
  const config = getR2Config();
  const client = getR2Client();

  if (config && client && !params.uploadId.startsWith('dev_upl_')) {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: params.objectKey,
        UploadId: params.uploadId,
      });
      await client.send(command);
    } catch (err: any) {
      console.warn('R2 AbortMultipartUpload error:', err.message);
    }
  }
}

export async function deleteR2Object(objectKey: string): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();

  if (config && client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
      });
      await client.send(command);
      return true;
    } catch (err: any) {
      console.error('R2 DeleteObject error:', err);
      return false;
    }
  }
  return true;
}
