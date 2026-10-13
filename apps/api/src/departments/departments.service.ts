import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: dto });
  }

  update(id: string, dto: Partial<CreateDepartmentDto>) {
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
