import { S3Client } from '@aws-sdk/client-s3';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  let bucketName = (process.env.R2_BUCKET_NAME || 'funclubsi-media').trim();
  if (!bucketName) {
    bucketName = 'funclubsi-media';
  }

  let endpoint = process.env.R2_ENDPOINT ? process.env.R2_ENDPOINT.trim() : '';
  const publicUrl = process.env.R2_PUBLIC_URL || '';

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  if (endpoint) {
    // Strip trailing slashes
    endpoint = endpoint.replace(/\/+$/, '');
    // If user mistakenly appended the bucket name, strip it
    if (endpoint.includes('.r2.cloudflarestorage.com')) {
      const match = endpoint.match(/https?:\/\/[^/]+\.r2\.cloudflarestorage\.com/);
      if (match) {
        endpoint = match[0];
      }
    }
  } else if (accountId) {
    endpoint = `https://${accountId.trim()}.r2.cloudflarestorage.com`;
  }

  if (!endpoint) {
    return null;
  }

  return {
    accountId: accountId || '',
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicUrl,
  };
}

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!config) return null;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}
