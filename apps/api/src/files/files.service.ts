import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

@Injectable()
export class FilesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private get storageRoot(): string {
    return this.configService.get<string>('STORAGE_ROOT') || path.join(process.cwd(), 'storage');
  }

  async save(file: { originalname: string; buffer: Buffer }) {
    await fs.mkdir(this.storageRoot, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileId = crypto.randomUUID();
    const storagePath = path.join(this.storageRoot, `${fileId}-${safeName}`);
    await fs.writeFile(storagePath, file.buffer);

    const token = this.jwtService.sign(
      { fileId, storagePath: path.basename(storagePath) },
      { secret: this.configService.getOrThrow<string>('JWT_SECRET'), expiresIn: '1h' },
    );

    return {
      fileId,
      fileName: safeName,
      downloadUrl: `/files/${token}`,
    };
  }

  async resolve(token: string) {
    const payload = this.jwtService.verify<{ storagePath: string }>(token, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });
    return path.join(this.storageRoot, payload.storagePath);
  }
}
