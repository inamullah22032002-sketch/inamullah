import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Ensure environment variables are loaded if dotenv is available
dotenv.config();

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string;
}

export interface R2ValidationStatus {
  configured: boolean;
  accountIdPresent: boolean;
  accessKeyPresent: boolean;
  secretKeyPresent: boolean;
  bucketPresent: boolean;
  endpointPresent: boolean;
  missing?: string[];
  connection?: 'ok' | 'failed' | 'unconfigured';
  error?: 'R2_AUTH_FAILED' | 'R2_BUCKET_ACCESS_FAILED' | 'R2_CONNECTION_FAILED';
  message?: string;
}

/**
 * Safely cleans environment variable inputs.
 * Strips accidental wrapping quotes, leading/trailing whitespace, newlines,
 * and key name repetitions like 'R2_ACCOUNT_ID=...' if pasted into Netlify UI.
 */
function cleanEnvVal(val?: string, keyPrefix?: string): string {
  if (!val) return '';
  let cleaned = val.trim();
  // Strip any accidental leading variable names like "R2_ENDPOINT=https://..."
  if (keyPrefix && cleaned.toLowerCase().startsWith(keyPrefix.toLowerCase() + '=')) {
    cleaned = cleaned.slice(keyPrefix.length + 1).trim();
  }
  // Strip surrounding quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  return cleaned;
}

/**
 * Evaluates R2 configuration dynamically at runtime from process.env.
 * Ensures Netlify Functions always read fresh environment variables.
 */
export function getR2Config(): R2Config | null {
  const accountId = cleanEnvVal(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID, 'R2_ACCOUNT_ID');
  const accessKeyId = cleanEnvVal(process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = cleanEnvVal(process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY');
  const bucketName = cleanEnvVal(process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME, 'R2_BUCKET_NAME') || 'funclubsi';
  const rawPublicUrl = cleanEnvVal(process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL, 'R2_PUBLIC_URL');
  let rawEndpoint = cleanEnvVal(process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT, 'R2_ENDPOINT');

  // Must have S3 credentials
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  // Derive accountId from endpoint if needed
  let effectiveAccountId = accountId;
  if (!effectiveAccountId && rawEndpoint) {
    const match = rawEndpoint.match(/https?:\/\/([^./]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      effectiveAccountId = match[1];
    }
  }

  // Derive or sanitize endpoint
  let endpoint = '';
  if (rawEndpoint) {
    endpoint = rawEndpoint.replace(/\/+$/, '');
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    // Clean to base S3 endpoint domain without bucket or subpath
    const domainMatch = endpoint.match(/https?:\/\/[^/]+\.r2\.cloudflarestorage\.com/i);
    if (domainMatch) {
      endpoint = domainMatch[0];
    }
  } else if (effectiveAccountId) {
    endpoint = `https://${effectiveAccountId}.r2.cloudflarestorage.com`;
  }

  if (!endpoint) {
    return null;
  }

  return {
    accountId: effectiveAccountId || '',
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicUrl: rawPublicUrl,
  };
}

let s3ClientInstance: S3Client | null = null;
let lastClientKey: string = '';

/**
 * Returns an authenticated S3Client for Cloudflare R2 operations.
 * Credentials remain server-side and are NEVER exposed.
 */
export function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!config) {
    s3ClientInstance = null;
    lastClientKey = '';
    return null;
  }

  const clientKey = `${config.endpoint}::${config.accessKeyId}::${config.secretAccessKey}`;
  if (!s3ClientInstance || lastClientKey !== clientKey) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    lastClientKey = clientKey;
  }

  return s3ClientInstance;
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/**
 * Validates presence of all required Cloudflare R2 environment variables.
 * NEVER returns credentials.
 */
export function checkR2EnvironmentVariables(): {
  configured: boolean;
  accountIdPresent: boolean;
  accessKeyPresent: boolean;
  secretKeyPresent: boolean;
  bucketPresent: boolean;
  endpointPresent: boolean;
  missing: string[];
} {
  const accountId = cleanEnvVal(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID, 'R2_ACCOUNT_ID');
  const accessKeyId = cleanEnvVal(process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = cleanEnvVal(process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY');
  const bucketName = cleanEnvVal(process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME, 'R2_BUCKET_NAME') || 'funclubsi';
  const rawEndpoint = cleanEnvVal(process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT, 'R2_ENDPOINT');

  let derivedAccountId = accountId;
  if (!derivedAccountId && rawEndpoint) {
    const match = rawEndpoint.match(/https?:\/\/([^./]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      derivedAccountId = match[1];
    }
  }

  const accountIdPresent = !!derivedAccountId;
  const accessKeyPresent = !!accessKeyId;
  const secretKeyPresent = !!secretAccessKey;
  const bucketPresent = !!bucketName;
  const endpointPresent = !!(rawEndpoint || derivedAccountId);

  const missing: string[] = [];
  if (!accountIdPresent) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyPresent) missing.push('R2_ACCESS_KEY_ID');
  if (!secretKeyPresent) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucketPresent) missing.push('R2_BUCKET_NAME');
  if (!endpointPresent) missing.push('R2_ENDPOINT');

  return {
    configured: missing.length === 0,
    accountIdPresent,
    accessKeyPresent,
    secretKeyPresent,
    bucketPresent,
    endpointPresent,
    missing,
  };
}

/**
 * Performs a lightweight S3 operation to test live connectivity to Cloudflare R2 bucket.
 * Accurately categorizes errors without exposing secrets.
 */
export async function testR2Connection(): Promise<{
  ok: boolean;
  status: 'ok' | 'R2_AUTH_FAILED' | 'R2_BUCKET_ACCESS_FAILED' | 'R2_CONNECTION_FAILED';
  message: string;
}> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config || !client) {
    return {
      ok: false,
      status: 'R2_CONNECTION_FAILED',
      message: 'Cloudflare R2 is not fully configured in environment variables.',
    };
  }

  try {
    // Lightweight S3 API call: List at most 1 key
    await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        MaxKeys: 1,
      })
    );

    return {
      ok: true,
      status: 'ok',
      message: 'Cloudflare R2 bucket connection verified successfully.',
    };
  } catch (err: any) {
    const errName = err?.name || '';
    const errMsg = (err?.message || '').toLowerCase();
    const httpStatus = err?.$metadata?.httpStatusCode;

    // Distinguish authentication failure from bucket access error
    if (
      errName === 'SignatureDoesNotMatch' ||
      errName === 'InvalidAccessKeyId' ||
      httpStatus === 401 ||
      (httpStatus === 403 && (errMsg.includes('signature') || errMsg.includes('credential') || errMsg.includes('key')))
    ) {
      return {
        ok: false,
        status: 'R2_AUTH_FAILED',
        message: 'Authentication failed. Please verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
      };
    }

    if (
      errName === 'NoSuchBucket' ||
      errName === 'AccessDenied' ||
      httpStatus === 404 ||
      httpStatus === 403
    ) {
      return {
        ok: false,
        status: 'R2_BUCKET_ACCESS_FAILED',
        message: `Bucket '${config.bucketName}' access denied or bucket does not exist. Check R2_BUCKET_NAME.`,
      };
    }

    return {
      ok: false,
      status: 'R2_CONNECTION_FAILED',
      message: `Failed to connect to Cloudflare R2 endpoint (${errName || 'Network error'}).`,
    };
  }
}

/**
 * Combines environment validation and live connectivity for the admin status endpoint.
 */
export async function getR2DetailedStatus(): Promise<R2ValidationStatus> {
  const envCheck = checkR2EnvironmentVariables();

  if (!envCheck.configured) {
    return {
      configured: false,
      accountIdPresent: envCheck.accountIdPresent,
      accessKeyPresent: envCheck.accessKeyPresent,
      secretKeyPresent: envCheck.secretKeyPresent,
      bucketPresent: envCheck.bucketPresent,
      endpointPresent: envCheck.endpointPresent,
      missing: envCheck.missing,
      connection: 'unconfigured',
      message: `Missing required environment variables: ${envCheck.missing.join(', ')}`,
    };
  }

  // If environment variables are present, perform live connection test
  const connTest = await testR2Connection();

  if (connTest.ok) {
    return {
      configured: true,
      accountIdPresent: true,
      accessKeyPresent: true,
      secretKeyPresent: true,
      bucketPresent: true,
      endpointPresent: true,
      connection: 'ok',
      message: connTest.message,
    };
  }

  return {
    configured: true,
    accountIdPresent: true,
    accessKeyPresent: true,
    secretKeyPresent: true,
    bucketPresent: true,
    endpointPresent: true,
    connection: 'failed',
    error: connTest.status === 'ok' ? 'R2_CONNECTION_FAILED' : connTest.status,
    message: connTest.message,
  };
}
