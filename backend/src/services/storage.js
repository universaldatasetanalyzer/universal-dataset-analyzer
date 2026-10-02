const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const provider = process.env.STORAGE_PROVIDER || 'local';
const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));

if (!['local', 's3'].includes(provider)) {
  throw new Error('STORAGE_PROVIDER must be local or s3');
}

if (provider === 's3' && (!process.env.STORAGE_BUCKET || !process.env.STORAGE_ENDPOINT ||
  !process.env.STORAGE_ACCESS_KEY_ID || !process.env.STORAGE_SECRET_ACCESS_KEY)) {
  throw new Error('STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY are required for s3 storage');
}

let s3Client;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION || 'auto',
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function storageError(operation, cause) {
  const error = new Error(`Storage ${operation} failed`);
  error.code = 'STORAGE_ERROR';
  error.status = 503;
  error.cause = cause;
  return error;
}

function isNotFoundError(error) {
  return error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;
}

function contentTypeForKey(objectKey) {
  const extension = path.extname(objectKey).toLowerCase();
  return {
    '.csv': 'text/csv',
    '.tsv': 'text/tab-separated-values',
    '.json': 'application/json',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.html': 'text/html; charset=utf-8',
  }[extension] || 'application/octet-stream';
}

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

function createObjectKey(ownerId, originalName, prefix = 'datasets') {
  const extension = path.extname(originalName || '').toLowerCase();
  return `${prefix}/${safeSegment(ownerId)}/${crypto.randomUUID()}${extension}`;
}

function localPathForKey(objectKey) {
  const normalized = String(objectKey || '').replace(/\\/g, '/');
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid storage object key');
  }
  return resolved;
}

async function ensureParent(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function putFile(localFilePath, objectKey) {
  if (provider === 'local') {
    const destination = localPathForKey(objectKey);
    await ensureParent(destination);
    if (path.resolve(localFilePath) !== destination) await fsp.copyFile(localFilePath, destination);
    return { key: objectKey, path: destination };
  }

  try {
    const stats = await fsp.stat(localFilePath);
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: objectKey,
      Body: fs.createReadStream(localFilePath),
      ContentLength: stats.size,
      ContentType: contentTypeForKey(objectKey),
    }));
    return { key: objectKey };
  } catch (err) {
    throw storageError('upload', err);
  }
}

async function putBuffer(buffer, objectKey) {
  if (provider === 'local') {
    const destination = localPathForKey(objectKey);
    await ensureParent(destination);
    await fsp.writeFile(destination, buffer);
    return { key: objectKey, path: destination };
  }

  try {
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: contentTypeForKey(objectKey),
    }));
    return { key: objectKey };
  } catch (err) {
    throw storageError('upload', err);
  }
}

async function readBuffer(objectKey) {
  if (provider === 'local') return fsp.readFile(localPathForKey(objectKey));

  try {
    const response = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: objectKey,
    }));
    if (!response.Body) throw new Error('Storage returned an empty object body');
    if (typeof response.Body.transformToByteArray === 'function') {
      return Buffer.from(await response.Body.transformToByteArray());
    }
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (err) {
    throw storageError('download', err);
  }
}

async function deleteObject(objectKeyOrPath) {
  if (!objectKeyOrPath) return;
  if (provider === 's3') {
    if (path.isAbsolute(String(objectKeyOrPath))) throw new Error('Invalid storage object key');
    try {
      await getS3Client().send(new DeleteObjectCommand({
        Bucket: process.env.STORAGE_BUCKET,
        Key: String(objectKeyOrPath),
      }));
    } catch (err) {
      throw storageError('delete', err);
    }
    return;
  }

  const candidate = String(objectKeyOrPath);
  const target = path.isAbsolute(candidate) ? path.resolve(candidate) : localPathForKey(candidate);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage path');
  try {
    await fsp.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function deleteTemporaryFile(filePath) {
  try {
    await fsp.unlink(path.resolve(filePath));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

async function exists(objectKeyOrPath) {
  if (provider === 's3') {
    if (!objectKeyOrPath || path.isAbsolute(String(objectKeyOrPath))) return false;
    try {
      await getS3Client().send(new HeadObjectCommand({
        Bucket: process.env.STORAGE_BUCKET,
        Key: String(objectKeyOrPath),
      }));
      return true;
    } catch (err) {
      if (isNotFoundError(err)) return false;
      throw storageError('check', err);
    }
  }

  try {
    const candidate = String(objectKeyOrPath || '');
    const target = path.isAbsolute(candidate) ? path.resolve(candidate) : localPathForKey(candidate);
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getLocalPath(objectKey) {
  if (provider !== 'local') throw new Error('Local paths are unavailable for s3 storage');
  return localPathForKey(objectKey);
}

async function materialize(objectKey, fallbackPath) {
  if (provider === 'local') return { path: fallbackPath || localPathForKey(objectKey), temporary: false };
  if (!objectKey && fallbackPath) return { path: fallbackPath, temporary: false };

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'uda-storage-'));
  const tempPath = path.join(tempDir, `object${path.extname(String(objectKey || ''))}`);
  try {
    await fsp.writeFile(tempPath, await readBuffer(objectKey));
    return { path: tempPath, temporary: true };
  } catch (err) {
    await fsp.rm(tempDir, { recursive: true, force: true });
    throw err;
  }
}

function getStorageInfo() {
  return {
    provider,
    root: provider === 'local' ? root : undefined,
    bucket: provider === 's3' ? process.env.STORAGE_BUCKET : undefined,
    endpoint: provider === 's3' ? process.env.STORAGE_ENDPOINT : undefined,
  };
}

module.exports = {
  provider,
  root,
  createObjectKey,
  getLocalPath,
  putFile,
  putBuffer,
  readBuffer,
  deleteObject,
  deleteTemporaryFile,
  exists,
  materialize,
  getStorageInfo,
};
