import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
