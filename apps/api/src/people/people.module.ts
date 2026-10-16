import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({ imports: [PrismaModule, AuditModule], controllers: [PeopleController], providers: [PeopleService], exports: [PeopleService] })
export class PeopleModule {}
