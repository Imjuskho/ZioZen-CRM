import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RolesGuard } from './common/roles.guard.js';
import { AuditModule } from './audit/audit.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { UsersModule } from './users/users.module.js';
import { CustomerNotesModule } from './customer-notes/customer-notes.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { FilesModule } from './files/files.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module.js';
import { ContractsModule } from './contracts/contracts.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { CreditNotesModule } from './credit-notes/credit-notes.module.js';
import { ProposalsModule } from './proposals/proposals.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { MilestonesModule } from './milestones/milestones.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { RecurringInvoicesModule } from './recurring-invoices/recurring-invoices.module.js';
import { CustomFieldsModule } from './custom-fields/custom-fields.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { TaskCommentsModule } from './task-comments/task-comments.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    DepartmentsModule,
    CustomersModule,
    ProjectsModule,
    TasksModule,
    InvoicesModule,
    UsersModule,
    CustomerNotesModule,
    ReportsModule,
    FilesModule,
    DocumentsModule,
    PaymentsModule,
    TaskCommentsModule,
    TicketsModule,
    CustomFieldsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
