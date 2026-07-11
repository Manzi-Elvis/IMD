import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AttachmentsService } from './attachments.service';

// Evidence attached to incidents is limited to what a responder would
// actually paste in: logs and screenshots. Deliberately no .exe/.zip/etc —
// this is an incident timeline, not a general file store, and a narrow
// allow-list is cheap insurance against someone using it as one.
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/json',
  'application/pdf',
  'application/zip', // for bundled log exports
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

@Controller('incidents/:incidentId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        // Randomized filename on disk — the original name is preserved only
        // as metadata in Postgres, never used as a path. This is what
        // prevents path traversal (`../../etc/passwd`) and collisions from
        // user-controlled input.
        filename: (_req, file, cb) => {
          const unique = randomUUID();
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestException(`File type "${file.mimetype}" is not allowed`), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Param('incidentId') incidentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    return this.attachmentsService.saveMetadata({
      incidentId,
      originalName: file.originalname,
      storageKey: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploader: user,
    });
  }

  @Get()
  findForIncident(@Param('incidentId') incidentId: string) {
    return this.attachmentsService.findForIncident(incidentId);
  }

  @Get(':attachmentId/download')
  async download(@Param('attachmentId') attachmentId: string, @Res() res: Response) {
    const attachment = await this.attachmentsService.findOne(attachmentId);
    const filePath = join(UPLOAD_DIR, attachment.storageKey);

    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'File missing from storage' });
      return;
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    );
    createReadStream(filePath).pipe(res);
  }
}
