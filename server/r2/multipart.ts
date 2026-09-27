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
import { getR2Client, getR2Config } from './config';

export interface CompletedPartInput {
  PartNumber: number;
  ETag: string;
}

/**
 * 1. Generate direct Presigned PutObject URL for small-file uploads (<= 50 MiB)
 * Direct Browser -> Cloudflare R2 S3 endpoint. Never proxies through Netlify.
 */
export async function createPresignedSingleUpload(params: {
  filename: string;
  mimeType: string;
  size: number;
  movieId?: string;
}): Promise<{ presignedUrl: string; objectKey: string; publicUrl: string }> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    throw new Error(
      'R2_NOT_CONFIGURED: Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID) must be set in server environment variables for direct video upload.'
    );
  }

  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueId = crypto.randomUUID();
  const movieId = params.movieId || 'media';
  const objectKey = `movies/${movieId}/${uniqueId}/${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ContentType: params.mimeType,
  });

  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  const publicUrl = config.publicUrl
    ? `${config.publicUrl.replace(/\/$/, '')}/${objectKey}`
    : `${config.endpoint}/${config.bucketName}/${objectKey}`;

  return { presignedUrl, objectKey, publicUrl };
}

/**
 * 2. Initiate Multipart Upload on Cloudflare R2
 * Direct S3 API call from server with small JSON only.
 */
export async function createMultipartUpload(params: {
  filename: string;
  mimeType: string;
  size: number;
  movieId?: string;
}): Promise<{ uploadId: string; objectKey: string; isDirectR2: true }> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    throw new Error(
      'R2_NOT_CONFIGURED: Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID) must be set in server environment variables for direct video upload.'
    );
  }

  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueId = crypto.randomUUID();
  const movieId = params.movieId || 'media';
  const objectKey = `movies/${movieId}/${uniqueId}/${sanitizedFilename}`;

  try {
    const command = new CreateMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      ContentType: params.mimeType,
    });

    const response = await client.send(command);
    if (!response.UploadId) {
      throw new Error('No UploadId received from Cloudflare R2 CreateMultipartUpload');
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

/**
 * 3. Generate genuine Cloudflare R2 Presigned UploadPart URL
 * Browser uploads chunk directly to this URL using HTTP PUT.
 */
export async function signUploadPart(params: {
  uploadId: string;
  objectKey: string;
  partNumber: number;
}): Promise<{ presignedUrl: string; isDirectR2: true }> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    throw new Error('R2_NOT_CONFIGURED: Cloudflare R2 credentials are missing or incomplete on the server.');
  }

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
    throw new Error(`PART_SIGNING_FAILED: ${err.message}`);
  }
}

/**
 * 4. Complete Multipart Upload on Cloudflare R2
 */
export async function completeMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
  parts: CompletedPartInput[];
}): Promise<{ publicUrl: string; objectKey: string }> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    throw new Error('R2_NOT_CONFIGURED: Cloudflare R2 credentials are missing or incomplete on the server.');
  }

  // Sort parts by PartNumber ascending (S3 requirement)
  const sortedParts = [...params.parts].sort((a, b) => a.PartNumber - b.PartNumber);

  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: params.objectKey,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
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

/**
 * 5. Abort Multipart Upload on Cloudflare R2
 */
export async function abortMultipartUpload(params: {
  uploadId: string;
  objectKey: string;
}): Promise<void> {
  const config = getR2Config();
  const client = getR2Client();

  if (config && client) {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: params.objectKey,
        UploadId: params.uploadId,
      });
      await client.send(command);
    } catch (err: any) {
      console.warn('R2 AbortMultipartUpload warning:', err.message);
    }
  }
}

/**
 * 6. Delete R2 Object
 */
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
  return false;
}
