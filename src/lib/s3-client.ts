import { S3Storage } from 'coze-coding-dev-sdk';

// 使用 coze-coding-dev-sdk 的 S3Storage（支持 Workload Identity 认证）
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

const s3Storage = {
  async uploadFile(params: { fileContent: Buffer | Blob; fileName: string; contentType: string }): Promise<string> {
    const key = await storage.uploadFile({
      fileContent: params.fileContent as Buffer,
      fileName: params.fileName,
      contentType: params.contentType,
    });
    return key;
  },

  async uploadFileStream(params: { filePath: string; fileName: string; contentType: string }): Promise<string> {
    const { createReadStream } = await import('fs');
    const stream = createReadStream(params.filePath);
    const key = await storage.streamUploadFile({
      stream,
      fileName: params.fileName,
      contentType: params.contentType,
    });
    return key;
  },

  async generatePresignedUrl(params: { key: string; expireTime: number; public?: boolean }): Promise<string> {
    const url = await storage.generatePresignedUrl({
      key: params.key,
      expireTime: params.expireTime,
    });
    return url;
  },

  async deleteFile(key: string): Promise<boolean> {
    try {
      return await storage.deleteFile({ fileKey: key });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[S3] 删除文件失败 key=${key}:`, message);
      return false;
    }
  },

  async readFile(params: { fileKey: string }): Promise<Buffer> {
    return await storage.readFile({ fileKey: params.fileKey });
  },

  async fileExists(params: { fileKey: string }): Promise<boolean> {
    return await storage.fileExists({ fileKey: params.fileKey });
  },

  async listFiles(params: { prefix?: string; maxKeys?: number; continuationToken?: string }) {
    return await storage.listFiles({
      prefix: params.prefix,
      maxKeys: params.maxKeys,
      continuationToken: params.continuationToken,
    });
  },

  async uploadFromUrl(params: { url: string; timeout?: number }): Promise<string> {
    return await storage.uploadFromUrl({
      url: params.url,
      timeout: params.timeout,
    });
  },
};

export { s3Storage };
export type S3StorageType = typeof s3Storage;
