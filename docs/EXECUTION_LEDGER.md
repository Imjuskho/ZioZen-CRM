# ZioZen CRM Module Execution Ledger

Status legend:
- `implemented` - modern service/controller/UI exists
- `partial` - core exists but needs parity work
- `planned` - in-scope but not built
- `externalize` - likely better as external service
- `retire` - low value; archive then remove

## Core platform
| Module | Status | Notes |
|---|---|---|
| Authentication / Staff Auth | implemented | JWT, department scoping foundation |
| Roles and Permissions | partial | Growing; enforcement broadening |
| Departments | implemented | Department-aware visibility |
| Audit Logging | implemented | Sensitive mutations available |
| Customer Portal Accounts | implemented | Admin provisioning, isolated portal session, department-scoped customer workspace UI, hardened invoice document route, and document-view audit events |
| Files / Documents | implemented/partial | Basic modern storage; hardening pending |

## Revenue and CRM
| Module | Status | Notes |
|---|---|---|
| Customers / Contacts | implemented | department-scoped |
| Leads | implemented | conversion and filters |
| Estimates / Quotes | implemented | items, conversion, status |
| Invoices | implemented | items/taxes/payments |
| Payments | implemented | batch payment and gateways extendable |
| Credit Notes | implemented | apply/reversal flows |
| Proposals | implemented | status, conversion to invoice |
| Contracts | implemented | agreements and status |
| Subscriptions | implemented | recurring billing and child invoices |
| Recurring Invoices | implemented | cron and tenant-safe schedules |
| Invoice Items Catalog | implemented | grouped item pieces |
| Expenses | implemented | direct expense-to-invoice path |
| Recurring Tasks | implemented | Department-scoped recurrence definitions with validated schedules |
| Proposals pipeline | partial | kanban and order improve seam |

## Delivery and support
| Module | Status |
|---|---|
| Projects | implemented |
| Tasks | implemented |
| Milestones | implemented |
| Task Comments/Notes | implemented |
| Tickets / Help Desk | implemented |
| Knowledge Base | implemented |
| Attachments | partial |
| Calendar | implemented |
| Announcements | implemented |
| Customer Portal | implemented | Secure login, department-scoped projects/invoices/tickets, escaped print-ready invoice documents, support conversations, and cross-customer access tests |

## Analytics, settings and extensibility
| Module | Status |
|---|---|
| Reports | partial |
| Custom Fields | implemented but needs detail |
| Webhooks | implemented |
| Audit dashboards | partial |
| Signal to Action | implemented | Unified department-scoped timeline, deterministic evidence-backed signals, audited lifecycle actions, configurable thresholds/cooldowns, and lifecycle metrics |

## Operations / ERP domains (long tail)
| Module | Status | Notes |
|---|---|---|
| Accounting | externalize/rebuild | schema likely in a later wave |
| Purchasing | planned | vendor workflow needed |
| Suppliers | planned | vendor/price pieces |
| Warehouse / Inventory | externalize candidate |
| Assets | externalize candidate |
| Manufacturing | externalize candidate |
| Construction | externalize candidate |
| Property Base | externalize candidate |

## HR/people
| Module | Status | Notes |
|---|---|---|
| HR Profiles | implemented | Department-scoped employee profiles with salary structures and employment metadata |
| HRM | implemented | Leave requests, manager decisions, generic approval records, and deterministic payroll batches |
| Staff approvals | implemented | Role-aware approval decisions with audited state transitions |
| Goals / OKR | implemented | Department-scoped objectives, measurable key results, progress states, and audit history |
| OKR | implemented | Exact Decimal target/current values with deterministic completion status |
| Appointments | implemented | Department-scoped scheduling with owner collision protection |

## Engagement and channels
| Module | Status |
|---|---|
| Surveys | planned |
| Marketing Automation | externalize candidate |
| Newsletter/Campaigns | externalize candidate |
| Appointments | planned |
| WhatsApp API | implemented/foundation | Provider-neutral signed inbound channel webhook with idempotent message intake |
| WhatsApp Chat | implemented/foundation | Unified department-scoped inbox threads and customer matching |
| WhatBot | integrate later |

## Knowledge and UX extensions
| Module | Status |
|---|---|
| KB Q&A tools | planned |
| Saved Filters | planned |
| Newsfeed / internal feed | planned |
| Search overlay | planned |
| Theme styling | planned |
| Dark mode | planned |
| Menu customization | planned |
| Data export | planned |
| Backup/restore | implement operational tooling |

## AI and optional tools
| Module | Status |
|---|---|
| OpenAI summaries | external complexity review pending |
| Predictive analytics | planned |

## Highest immediate next steps
0. Pilot Signal to Action with one department and measure action usefulness, false positives, and time-to-resolution.
1. Wave 1B: implemented — transactional credit-note applications, exact Decimal balances, over-application protection, and scoped audit records.
2. Wave 2A: implemented — department-scoped chart of accounts, balanced Decimal journal posting, journal history, and trial balance API.
3. Wave 2B: implemented — invoice issuance and payments auto-post balanced journal entries, with deterministic P&L reporting.
4. Wave 2C: implemented — credit-note auto-journaling, immutable reversal entries, and department-scoped period close controls.
5. Wave 3A: implemented — scoped reconciliation sessions, exact bank-to-journal matching, close controls, and actionable finance exception queues.
6. Wave 3B: implemented — CSV statement imports, deterministic amount/date suggestions, and explicit accept/reject decisions without auto-acceptance.
7. Wave 3C: implemented — provider adapter registry, department-scoped aging policies, deterministic escalation, and audit trails.
8. Wave 4A: implemented — close-readiness dashboards and period-end sign-off controls.
9. Wave 4B: implemented — department-scoped HR profiles, leave overlap protection, role-aware approvals, and exact Decimal payroll batches.
10. Wave 5A: implemented — idempotent automation rules/runs with deterministic signal and task actions.
11. Wave 5B: implemented — provider-neutral omnichannel inbox channels, signed inbound webhooks, customer matching, and duplicate delivery protection.
12. Wave 6A: implemented — recurring task definitions, department-scoped OKRs/key results, and appointment scheduling with collision protection.
2. Implement receipt/document printer better.
3. Add direct file download / preview flows.
4. Implement document and PDF generation service.
5. Implement report exports and saved filters.
6. Define core ERP / people roadmap decisions.
