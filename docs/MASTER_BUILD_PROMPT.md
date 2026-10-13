# Master Build Prompt: ZioZen CRM

Use this prompt with a coding agent. The objective is to build and maintain a complete, production-grade CRM that reaches full functional parity with Perfex CRM, including its commonly used core modules, while being more maintainable, faster, better tested, auditable, and future-proof.

Do not copy proprietary Perfex or marketplace module code. Rebuild every capability in a clean-room manner from business requirements and from data exports that we own. You may use exported business data, document templates, report definitions, and workflow descriptions. Do not reverse-engineer protected or commercial source for reuse.

## Product identity

- Product name: ZioZen CRM
- Positioning: Enterprise department-aware CRM
- Target users: admins, managers, staff, customers, external approvers
- Primary business domains: CRM, project delivery, support, sales, billing, subscriptions, contracts, knowledge base, collaboration, administration

## Definition of done

The build is not complete when screens exist. It is complete only when:

1. A user can perform the full Perfex-equivalent workflow end to end without touching legacy CRM.
2. Data is scoped by role and department.
3. All significant mutations are auditable.
4. API and UI tests cover authorization, happy paths, and known edge cases.
5. The app builds, tests pass, and deployment is documented.
6. A controlled migration has been validated against exported legacy data.
7. No build step depends on proprietary code.
8. Performance, security, backup, and monitoring checks pass.

## Mandatory engineering rules

- Use clean architecture with clear domain, application, infrastructure, and presentation layers.
- Validate all input with schemas.
- Enforce authorization in the domain/application layer, not only in UI.
- Use database migrations. Never manually edit production schema.
- Use stable APIs with versioning.
- Log every sensitive operation.
- Add automated tests for every module.
- Keep public files, secrets, uploads, and logs outside public web root.
- Use environment variables for configuration.
- Prefer idempotent migration and import scripts.
- Keep module dependencies explicit.
- Document public events, jobs, and webhooks.
- Do not mark a feature complete until it has UI, API, validation, authorization, tests, and documentation.

## Recommended stack

- Backend: NestJS + TypeScript
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Cache/jobs: Redis + BullMQ
- Storage: S3-compatible signed URLs
- Email: provider abstraction with SMTP/API drivers
- PDF: HTML template to PDF pipeline
- Tests: Vitest, Supertest, Playwright
- CI/CD: GitHub Actions
- Infra: Docker Compose locally, containerized production

## High-level architecture

Create a modular monolith first, with bounded contexts that can later be split.

Bounded contexts:

- identity and access
- departments and tenancy
- customers and contacts
- leads and opportunities
- projects and tasks
- milestones and files
- support tickets and knowledge base
- estimates and proposals
- invoices and credit notes
- payments and gateways
- subscriptions and recurring billing
- contracts
- calendar, reminders, and activity
- expenses, purchases, and accounting integrations
- notifications, email, and announcements
- automation, webhooks, and integrations
- settings, custom fields, and localization
- reporting and dashboards
- imports, exports, and migrations

Cross-cutting services:

- audit
- permissions
- settings
- feature flags
- file storage
- document generation
- rate limiting
- search
- event bus
- job queue
- notification dispatch

## Required core features

Implement these as first-class capabilities, not optional add-ons.

### Authentication and users

- login, logout, password reset, registration if enabled
- multi-factor authentication
- roles: admin, manager, member, viewer, customer portal user
- staff profiles, departments, multiple department memberships
- user activation, password policies, session management
- API tokens with scopes and expiry

### Company and customer management

- customers and contacts
- multiple contacts per customer
- billing/shipping addresses
- customer profile, notes, files, reminders
- customer grouping, tags, custom fields
- import and export
- merge duplicate customer records
- customer portal access

### Leads and sales

- lead capture forms
- lead statuses and sources
- lead assignment, ownership, and visibility
- lead notes, files, reminders, activity timeline
- lead conversion to customer and optionally project
- proposals with public view and accept/reject actions
- estimates with line items and conversion to invoices
- sales pipeline reporting
- duplicate detection and lead merging

### Project delivery

- projects, milestones, tasks, subtasks, checklists
- task assignments, due dates, priorities, statuses, dependencies
- recurring tasks if required
- time tracking and timer tracking
- discussion threads
- project files and notes
- project expenses and bills
- Gantt-style planning support or timeline equivalent
- project profitability reporting

### Support

- support departments
- tickets, priorities, statuses, assignments
- predefined replies
- internal notes and public replies
- ticket attachments
- service level targets
- customer satisfaction
- knowledge base categories and articles
- announcements

### Billing and finance

- invoices with line items, taxes, discounts, totals, payment terms
- recurring invoices
- estimates and credit notes
- proposals with acceptance
- payment recording
- payment gateway integration abstraction
- invoice PDF generation
- invoice email sending
- partial payments
- overdue handling and reminders
- numbering and templating rules
- multi-currency support
- credit application and refunds

### Contracts and subscriptions

- contracts with terms, value, renewal, attachments, and signatures or signature integration
- contract renewal tracking
- subscriptions with billing cycle, next billing date, invoices, upgrades, cancellation
- subscription status history
- dunning and retry handling if using gateways

### Administration

- settings: company, email, localization, tax, currency, branding
- custom fields for all major entities
- email templates for all document types and notifications
- role and permission management
- module enable/disable
- automation rules
- cron and background jobs
- audit logs and activity history
- database backups and restore procedures
- localization and translation management
- webhook management
- API token management

### Knowledge and collaboration

- announcements
- knowledge base with categories, tags, SEO metadata
- calendar events and reminders
- activity timelines
- mentions and notifications where useful
- news feed if retained from the business

### Reporting

- sales overview
- invoices and revenue
- overdue invoices
- estimates summary
- proposal summary
- project summary
- task summary
- department summary
- customer summary
- expense summary
- profitability
- custom report filters where practical
- saved report views if useful

## Data model requirements

Design a PostgreSQL schema with at least these entities and appropriate relations. Adjust names as needed but preserve the capabilities.

Core entities:

- User
- Role
- Permission
- Department
- UserDepartment
- Customer
- Contact
- CustomerTag
- Lead
- LeadStatus
- LeadSource
- Project
- Task
- TaskComment
- Milestone
- Timesheet
- ProjectFile
- Note
- Ticket
- TicketReply
- KnowledgeArticle
- KnowledgeCategory
- Estimate
- EstimateItem
- Proposal
- ProposalItem
- Invoice
- InvoiceItem
- Payment
- CreditNote
- CreditNoteItem
- Subscription
- Contract
- RecurringInvoice
- Expense
- Event
- Reminder
- Notification
- AuditLog
- CustomField
- CustomFieldValue
- Setting
- EmailTemplate
- Attachment
- ApiToken
- Webhook
- WebhookDelivery
- ImportJob
- ExportJob
- Announcement

Each entity should include:

- stable IDs
- timestamps
- soft delete where business-relevant
- ownership and department scoping where business-relevant
- indexes for common query patterns
- validation rules documented in code

## Permission model

Implement granular permissions with role presets and per-user overrides.

Minimum permission categories:

- view, create, edit, delete for each module
- view own vs view all
- manage settings
- manage roles
- view reports
- export data
- manage integrations
- administer API tokens

Department scoping rules:

- Admin sees all departments and all records.
- Other users see only records in their assigned departments.
- A user assigned to multiple departments sees combined records.
- Permission checks must run in the service layer.
- API responses must not leak records from unauthorized departments.

## API requirements

Use REST with `/api/v1` prefixes or a clearly documented convention.

Every module should expose endpoints for:

- list
- detail
- create
- update
- delete or archive
- batch actions where practical
- report/filter endpoints where practical

Add:

- pagination
- sorting
- filtering
- search
- consistent error format
- OpenAPI documentation
- idempotency for import/export and webhook-triggered operations

## Frontend requirements

Build a responsive web application with:

- authenticated app shell
- role/permission-aware navigation
- list pages with search, filters, sorting, pagination
- detail pages
- create/edit forms
- department selector where appropriate
- activity timelines
- dashboard widgets
- document preview
- notification surfaces
- mobile-friendly layouts
- accessible forms and keyboard navigation

UI must be complete enough that no critical workflow requires the API console.

## Document and email requirements

Generate professional documents for:

- estimates
- proposals
- invoices
- credit notes
- contracts

Each document type should support:

- HTML preview
- PDF export
- department branding
- merge fields
- template overrides
- email delivery
- delivery logging
- status tracking

## Automation requirements

Implement a job system for:

- recurring invoice generation
- reminder emails
- payment overdue alerts
- ticket assignment/SLA handling
- webhook dispatch
- import/export processing
- scheduled reports
- cleanup and retention policies

Use retries, dead-letter handling, and job status visibility.

## Search requirements

Implement full-text search across at least:

- customers
- leads
- projects
- tasks
- tickets
- knowledge base
- notes
- contacts
- invoices
- estimates

Search should respect authorization and department scope.

## Migration requirements

Build migration tooling that:

- verifies database connectivity
- exports module data from legacy CRM
- validates row counts and referential integrity
- imports users, departments, customers, projects, tasks, invoices, and other relevant entities
- supports dry-run mode
- writes a migration report
- supports rollback or retry

## Security requirements

- enforce HTTPS
- use secure cookies and CSRF strategy
- hash passwords with modern algorithms
- rotate and revoke API tokens
- prevent direct access to sensitive files
- scan uploaded files
- log security-relevant events
- limit auth attempt rates
- configure CORS, CSP, and security headers
- avoid exposing stack traces in production

## Quality requirements

Before every phase completion, run:

- unit tests
- integration tests
- authorization tests
- migration tests where relevant
- end-to-end tests for critical workflows
- lint and type checks
- build checks
- security review
- performance checks for list and report endpoints

## Delivery phases

Phase 1: Core foundation

- auth
- users
- roles
- departments
- settings
- audit
- API tokens
- base UI shell

Phase 2: Customer and project core

- customers
- contacts
- notes
- projects
- tasks
- milestones
- files
- calendar
- notifications

Phase 3: Sales and finance

- leads
- estimates
- invoices
- invoice items
- payments
- credit notes
- proposals
- recurring invoices
- totals, taxes, discounts

Phase 4: Service and collaboration

- tickets
- knowledge base
- announcements
- comments
- reminders
- events

Phase 5: Finance depth

- subscriptions
- contracts
- expenses
- currency and taxes
- recurring jobs

Phase 6: Administration and extensibility

- custom fields
- email templates
- role permissions UI
- module toggles
- settings
- webhooks

Phase 7: Reporting and migration

- reports
- dashboard widgets
- import/export
- migration tooling
- validation reports

Phase 8: Hardening

- security
- performance
- accessibility
- backup/restore
- documentation
- production deployment

## Suggested agent execution instruction

Work through the phases in order. Implement each feature fully before moving to the next. Do not mark a phase complete until its API, UI, authorization, tests, documentation, and migration considerations are done. If a phase is too large, split it into smaller pull-request-sized steps but keep dependency order.

When uncertain, inspect the current repository and generated schema, then make the smallest coherent change that preserves architecture. Never claim a broad parity milestone unless the implementation is proven by tests and a live end-to-end workflow.

## Immediate next prompt for the coding agent

Build Phase 1 and Phase 2 completely before touching Phase 3. Start with schema and migrations for users, roles, permissions, departments, customers, contacts, leads, projects, tasks, milestones, notes, files, calendar, notifications, audit logs, settings, and custom fields. Then implement API, UI, authorization, tests, and documentation for each. After that, verify the full customer-to-project workflow manually with tests before beginning sales features.

## Anti-overstatement rule for the agent

Do not say the CRM is complete, comparable to Perfex, or production-ready unless the relevant phase acceptance criteria are satisfied and verified. If work is scaffolded only, describe it as scaffolded. If work is partial, describe it as partial. If work is not yet wired into UI or tests, say so explicitly.

---

Produce implementation artifacts, not status optimism.