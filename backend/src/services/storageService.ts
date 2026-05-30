// backend/src/services/storageService.ts

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const IS_DEV_STORAGE =
  !process.env.R2_ACCESS_KEY_ID ||
  process.env.R2_ACCESS_KEY_ID === 'placeholder';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const accountId = process.env.R2_ACCOUNT_ID ?? 'placeholder';
const bucket = process.env.R2_BUCKET_NAME ?? 'docsync-documents';

const r2 = IS_DEV_STORAGE
  ? null
  : new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });

export interface UploadResult {
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  prefix: string
): Promise<UploadResult> {
  const ext = originalName.split('.').pop() ?? 'bin';
  const key = `${prefix}/${randomUUID()}.${ext}`;

  if (IS_DEV_STORAGE) {
    const localPath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    console.log(`[dev-storage] Saved file locally: ${localPath}`);
  } else {
    await r2!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
      })
    );
  }

  return { key, fileName: originalName, fileSize: buffer.length, mimeType };
}

export async function getPresignedUrl(key: string): Promise<string> {
  if (IS_DEV_STORAGE) {
    return `http://localhost:3000/uploads/${key}`;
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2!, command, { expiresIn: 3600 });
}

export async function deleteFile(key: string): Promise<void> {
  if (IS_DEV_STORAGE) {
    const localPath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.unlink(localPath).catch(() => {});
    return;
  }
  await r2!.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
