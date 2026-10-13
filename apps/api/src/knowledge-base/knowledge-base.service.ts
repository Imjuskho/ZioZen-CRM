import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}
  list(publishedOnly = true) { return this.prisma.knowledgeArticle.findMany({ where: publishedOnly ? { published: true } : {}, orderBy: { createdAt: 'desc' } }); }
  create(dto: any) { return this.prisma.knowledgeArticle.create({ data: dto }); }
  update(id: string, dto: any) { return this.prisma.knowledgeArticle.update({ where: { id }, data: dto }); }
}
