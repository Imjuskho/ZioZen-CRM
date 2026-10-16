# ZioZen Capability Matrix

**Updated:** 2026-10-13  
**Purpose:** The source of truth for what is visible, testable, and sellable.

## Status definitions

- **Production-ready:** Complete browser workflow, server authorization, tests, observability, recovery path, and support documentation.
- **Pilot-ready:** Core workflow exists and is testable with controlled customers, but one or more enterprise hardening gates remain.
- **Foundation only:** API, schema, migration, or partial UI exists; do not sell as a finished capability.

## Current matrix

| Capability | API / data foundation | Visible UI | Current status | Next gate |
|---|---:|---:|---|---|
| Authentication and staff sessions | Yes | Yes | Pilot-ready | MFA, SSO, session/security event controls |
| Departments and scope isolation | Yes | Yes | Pilot-ready | Permission matrix and negative authorization suite |
| Customers and customer timeline | Yes | Yes | Pilot-ready | Full 360 workspace, bulk actions, import/export |
| Projects, tasks, milestones | Yes | Yes | Pilot-ready | Dependencies, saved views, richer ownership workflow |
| Leads and estimates | Yes | Yes | Pilot-ready | Complete conversion flow and audit history |
| Invoices and payments | Yes | Yes | Pilot-ready | Reconciliation, period locks, accounting exports |
| Credit notes | Yes | Partial | Foundation only | Complete UI lifecycle and finance test coverage |
| Accounting ledger and close | Yes | Partial | Foundation only | Controlled close workflow and month-end pilot |
| Reconciliation and exceptions | Yes | Partial | Foundation only | Import UI, matching review, retries, evidence export |
| Support tickets and knowledge base | Yes | Yes | Pilot-ready | SLA workflow, assignment, customer-facing support loop |
| Customer portal | Yes | Partial | Foundation only | Production onboarding, permissions, files, notifications |
| People and employee profiles | Yes | Yes | Pilot-ready | Lifecycle, privacy controls, directory actions |
| Leave and approvals | Yes | Partial | Foundation only | Calendars, policy rules, delegation, end-to-end UI |
| Payroll batches and payslips | Yes | No | Foundation only | Jurisdiction plan, validation, export, approval, privacy |
| Goals and key results | Yes | Yes | Pilot-ready | Progress history, linking, period close |
| Appointments and recurring tasks | Yes | Yes | Pilot-ready | Timezone rules, reminders, missed-run handling |
| Automation rules and runs | Yes | Partial | Foundation only | Rule builder, run log, retry/dead-letter controls |
| Operational signals | Yes | Yes | Pilot-ready | Escalation, evidence UX, SLA metrics |
| Omnichannel inbox | Yes | Partial | Foundation only | Provider adapters, outbound lifecycle, attachments, retry |
| Custom fields and webhooks | Yes | Yes | Pilot-ready | Admin configuration, delivery history, secret rotation |
| Settings / Setup control plane | Partial | Yes | Foundation only | Self-service organization, RBAC, approvals, integrations |
| Audit logs | Yes | Partial | Foundation only | Search, export, retention, immutable evidence package |
| Backup and restore | Partial | No | Foundation only | Scheduled backups, restore rehearsal, tenant export |
| Billing and entitlements | No | No | Foundation only | Plans, metering, subscription lifecycle |
| SSO, MFA, SCIM | No | No | Foundation only | Enterprise identity workstream |

## First release claims

The safe near-term claim is:

> ZioZen is a department-aware CRM and operations platform for controlled rollout, unifying customers, sales, delivery, finance visibility, support, people operations, planning, and operational signals.

Do not claim complete enterprise ERP, certified payroll, universal omnichannel messaging, or replacement accounting until the relevant rows reach **Production-ready**.
