import { S3Client } from '@aws-sdk/client-s3';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string;
}

function cleanEnvVal(val?: string, keyPrefix?: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  if (keyPrefix && cleaned.toLowerCase().startsWith(keyPrefix.toLowerCase() + '=')) {
    cleaned = cleaned.slice(keyPrefix.length + 1).trim();
  }
  // Remove wrapping quotes if present
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  return cleaned;
}

export function getR2Config(): R2Config | null {
  const accountId = cleanEnvVal(process.env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID');
  const accessKeyId = cleanEnvVal(process.env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = cleanEnvVal(process.env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY');
  let bucketName = cleanEnvVal(process.env.R2_BUCKET_NAME, 'R2_BUCKET_NAME') || 'funclubsi';

  let rawEndpoint = cleanEnvVal(process.env.R2_ENDPOINT, 'R2_ENDPOINT');
  const rawPublicUrl = cleanEnvVal(process.env.R2_PUBLIC_URL, 'R2_PUBLIC_URL');

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  let endpoint = '';
  if (rawEndpoint) {
    // Strip trailing slashes
    endpoint = rawEndpoint.replace(/\/+$/, '');
    // If endpoint is missing protocol, prepend https://
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    // If user mistakenly appended the bucket name or path, extract the base R2 domain
    if (endpoint.includes('.r2.cloudflarestorage.com')) {
      const match = endpoint.match(/https?:\/\/[^/]+\.r2\.cloudflarestorage\.com/);
      if (match) {
        endpoint = match[0];
      }
    }
  } else if (accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
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
    publicUrl: rawPublicUrl,
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
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}
