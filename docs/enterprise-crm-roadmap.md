# ZioZen Enterprise CRM Product Roadmap

**Document status:** Proposed execution roadmap  
**Audience:** Product, engineering, design, security, finance, customer success, and growth  
**Baseline:** Current Waves 1–6 foundations, including CRM, delivery, finance operations, people, planning, automation, inbox, governance, and the new Settings / Setup control plane.

## Executive position

ZioZen has a meaningful operating-system foundation, but it is not yet an enterprise-ready CRM product. The principal gap is not the number of API modules. It is the distance between **domain foundations** and a product that is:

- complete in the browser;
- safe and predictable under real company workloads;
- configurable without engineering help;
- observable and supportable;
- secure and auditable;
- integrated with the systems companies already use;
- backed by reliable migration, backup, billing, and customer-success processes.

The roadmap should therefore optimize for **end-to-end business outcomes**, not additional isolated modules.

> **North-star outcome:** A company can configure ZioZen, import its operating data, invite teams, run customer-to-cash workflows, automate routine work, and recover safely from failure without needing engineering intervention.

---

## Product strategy

### Target customer wedge

Start with **service businesses and multi-department professional teams** that need customer, delivery, finance, and support context in one place. Examples include agencies, consultancies, studios, managed service providers, implementation partners, and operations-heavy B2B teams.

Do not initially compete head-on with every ERP, HRIS, helpdesk, and marketing-automation suite. Win on:

1. department-aware operating context;
2. customer-to-delivery-to-cash continuity;
3. operational signals and automation;
4. a configurable control plane;
5. lower fragmentation for growing teams.

### Product principles

1. **Vertical slices over module count.** Finish workflows from start to finish before adding adjacent surfaces.
2. **Configuration before customization.** Enterprise behavior should be adjustable through Settings, not code forks.
3. **Every mutation is auditable.** Actor, scope, before/after state, reason, and correlation ID must be available.
4. **Department scope is a security boundary.** It is not merely a filter in the UI.
5. **No silent failure.** Background jobs, imports, webhooks, and integrations require visible status and retry behavior.
6. **Sell only what is production-proven.** A backend model is not a customer-facing feature until the complete workflow is usable and tested.

---

# Roadmap overview

| Phase | Name | Primary outcome | Suggested gate |
|---|---|---|---|
| 0 | Product truth and stabilization | Establish a reliable baseline and stop over-claiming | No critical build, auth, migration, or scope-isolation defects |
| 1 | Core CRM productization | Deliver a polished, dependable CRM and customer-to-cash loop | First reference customers can run daily work without spreadsheets for agreed workflows |
| 2 | Enterprise control plane | Make setup, access, governance, and configuration self-service | Admins can onboard and govern an organization without engineering |
| 3 | Operational automation | Turn signals, rules, recurring work, and inbox into reliable automation | Automations are observable, retryable, idempotent, and trusted |
| 4 | Finance and people hardening | Make finance operations and people workflows safe enough for production use | Reconciliation, approvals, payroll exports, and audit evidence pass customer pilots |
| 5 | Enterprise platform readiness | Add reliability, security, integrations, data lifecycle, and support operations | Security and reliability gates pass a controlled production launch |
| 6 | Scale and ecosystem | Support larger customers and create a repeatable commercial engine | Multi-tenant scale, partner integrations, SLAs, and expansion revenue are proven |

---

# Phase 0 — Product truth and stabilization

**Goal:** Make the current product understandable, testable, and safe enough to build on.

## Product work

- Create an authoritative capability matrix with three states:
  - **Production-ready**
  - **Pilot-ready**
  - **Foundation only**
- Map every API module to a visible frontend workflow, owner, test suite, and release status.
- Define the first three end-to-end journeys:
  1. lead → customer → project → task → invoice → payment;
  2. customer → ticket → reply → resolution → audit event;
  3. employee → leave request → approval → audit event.
- Remove or label UI actions that do not yet perform the advertised business action.
- Define tenant, department, role, and record-ownership terminology consistently.

## Engineering work

- Stabilize local and CI startup:
  - deterministic environment setup;
  - database bootstrapping;
  - seed data separated from production migrations;
  - health and readiness endpoints;
  - documented ports and credentials.
- Add a single API error contract with stable error codes.
- Add request correlation IDs and structured server logs.
- Establish migration policy:
  - forward-only migrations;
  - migration review checklist;
  - rollback or recovery procedure;
  - production migration rehearsal.
- Add contract tests for the frontend API client.
- Add department-scope tests to every protected module.

## Exit criteria

- No known critical auth or data-isolation issue.
- Every advertised navigation item has a documented capability status.
- Core API and web builds pass in CI.
- Seed, migration, and reset procedures work from a clean machine.
- A new engineer can run the product using the README only.

---

# Phase 1 — Core CRM productization

**Goal:** Make the CRM valuable every day before expanding the surface area.

## Priority vertical slice: customer-to-cash

### Customer workspace

- Customer 360 page with:
  - profile and contacts;
  - projects and tasks;
  - leads and estimates;
  - invoices, payments, and credits;
  - contracts and subscriptions;
  - tickets and replies;
  - notes and timeline;
  - files and activity.
- Record-level search, filtering, saved views, and bulk actions.
- Clear relationship between customer, company, department, and owner.

### Sales to delivery

- Real lead stage transitions with validation and audit history.
- Estimate/proposal creation, versioning, acceptance, and conversion.
- Project creation from accepted work.
- Task assignment, due dates, dependencies, milestones, and completion rules.
- Activity timeline that follows the customer across stages.

### Customer support

- Ticket list, detail, assignment, priority, SLA target, replies, internal notes, and resolution.
- Searchable knowledge base.
- Customer portal ticket flow.
- Visible SLA state and escalation actions.

### Finance visibility

- Invoice lifecycle: draft → issued → partially paid → paid/overdue/void.
- Payment allocation and reconciliation evidence.
- Credit note application and reversal.
- Finance exceptions linked back to the relevant customer/project.

## UX quality bar

- Consistent empty, loading, error, and success states.
- Keyboard navigation and focus behavior.
- Responsive desktop and tablet layouts.
- Bulk actions and pagination for all list views.
- No data table should rely on a truncated label to understand record state.

## Exit criteria

- Five pilot companies can run the complete customer-to-cash journey in the product.
- Product analytics show successful completion of each critical workflow.
- No critical workflow requires direct database edits.
- Support can diagnose common failures from logs and audit history.

---

# Phase 2 — Enterprise control plane

**Goal:** Make the product configurable and governable by customer administrators.

The Settings / Setup page becomes a real control plane rather than a directory of links.

## Organization and tenancy

- Organization profile, legal name, default currency, timezone, locale, date format, fiscal year, and business hours.
- Multiple business units and departments.
- Parent/child department hierarchy.
- Record visibility policies:
  - own records;
  - department records;
  - cross-department records;
  - organization-wide records.
- Default ownership and routing rules.

## Identity and access

- Role-based access control with explicit permissions, not only broad role names.
- Permission groups and custom roles.
- Department memberships and effective-permission preview.
- SSO via SAML and OIDC.
- MFA enforcement and session policy.
- SCIM provisioning and deprovisioning.
- Login history and security events.
- Impersonation only with explicit approval, time limit, banner, and audit trail.

## Data model configuration

- Custom fields with field types, validation, options, visibility, and requiredness.
- Custom statuses and pipeline stages.
- Naming and terminology overrides.
- Record layouts and conditional sections.
- Saved filters and shared views.
- Import/export mapping templates.

## Workflow and governance configuration

- Approval policies for:
  - discounts;
  - estimates;
  - invoices and credits;
  - leave;
  - payroll batches;
  - sensitive customer changes.
- Retention and deletion policies.
- Audit-log search, export, and retention controls.
- Webhook management with signing secrets, event selection, delivery history, replay, and rotation.
- Notification policies for email and in-app alerts.

## Exit criteria

- A customer admin can onboard an organization, invite users, create departments, configure permissions, add fields, and establish approval rules without engineering.
- Effective access can be previewed before changes are saved.
- Every security-sensitive setting has an audit record.
- SSO/MFA and user lifecycle controls pass an enterprise pilot.

---

# Phase 3 — Operational automation

**Goal:** Make ZioZen proactive without making it unpredictable.

## Automation engine

- Rule builder with:
  - event trigger;
  - conditions;
  - actions;
  - delay/schedule;
  - department scope;
  - approval requirement;
  - active window;
  - owner.
- Versioned rules and draft/publish workflow.
- Test-run and preview mode.
- Idempotency keys and deduplication.
- Retry policy with exponential backoff.
- Dead-letter queue and manual replay.
- Run log with inputs, outputs, duration, error, and actor.
- Rate limits and loop protection.

## Operational signals

- Signal inbox with severity, evidence, owner, SLA, and next action.
- Dismissal reasons and snooze scheduling.
- Escalation rules.
- Signal-to-record navigation.
- Metrics for created, resolved, dismissed, average resolution time, and recurring causes.

## Recurring work and OKRs

- Recurring task templates with timezone-aware scheduling.
- Missed-run handling.
- Goal hierarchy, key-result formulas, progress history, and period close.
- Linking goals to projects, tasks, and signals.

## Inbox

- Channel configuration page.
- Inbound and outbound message lifecycle.
- Provider adapters for email first, then selected messaging channels.
- Thread assignment, tags, status, SLA, internal notes, attachments, and customer matching.
- Delivery state and retry visibility.

## Exit criteria

- A customer can create, test, publish, monitor, retry, and disable automation without engineering.
- No duplicate automation action is observed under repeated event delivery.
- Inbox messages have deterministic customer/thread matching.
- Operators trust the system because every automated action is explainable.

---

# Phase 4 — Finance and people hardening

**Goal:** Move the Wave 4 foundations from “API capability” to controlled production workflows.

## Finance

- Clear accounting boundary: what ZioZen owns versus what is exported to the system of record.
- Period close checklist and lock enforcement.
- Reconciliation import validation and duplicate detection.
- Bank/account feed adapter or robust CSV import with mapping templates.
- Tax/VAT configuration by jurisdiction where applicable.
- Multi-currency rules and FX treatment.
- Invoice numbering and legal document configuration.
- Approval thresholds and segregation of duties.
- Immutable financial event history.
- Export to common accounting platforms.
- Month-end reports and evidence package.

## People and payroll

- Employee lifecycle: invite, activate, transfer, suspend, terminate.
- Leave calendars, public holidays, accrual rules, carry-over, and blackout periods.
- Approval delegation and absence coverage.
- Payroll input collection, validation, lock, approval, export, and payslip access.
- Explicit jurisdiction support plan before promising payroll compliance.
- Privacy controls for sensitive employee data.
- Field-level access where needed.

## Exit criteria

- Finance pilot completes a month-end close without manual database intervention.
- Payroll pilot produces a validated export and auditable approval trail.
- Sensitive employee and financial data have documented access policies.
- Product messaging clearly distinguishes operational support from regulated compliance.

---

# Phase 5 — Enterprise platform readiness

**Goal:** Make the platform dependable under enterprise expectations.

## Reliability and scale

- Production deployment topology with separate web, API, worker, and database roles.
- Queue-backed background jobs.
- Horizontal API scaling.
- Database indexing, query budgets, connection pooling, and slow-query monitoring.
- Caching strategy with invalidation rules.
- Rate limiting and abuse protection.
- Large-list pagination and export jobs.
- Load tests for representative tenant sizes.
- Defined SLOs:
  - API availability;
  - p95 latency;
  - background-job completion;
  - webhook delivery;
  - recovery time objective;
  - recovery point objective.

## Security

- Threat model and security review for each trust boundary.
- OWASP ASVS-aligned application review.
- Dependency and container scanning.
- Secrets manager and rotation procedures.
- Encryption in transit and at rest.
- Backup encryption and access control.
- Security incident response plan.
- Vulnerability disclosure process.
- Annual penetration test before enterprise launch.
- SOC 2 readiness workstream if the target market requires it.

## Data lifecycle

- Import wizard with validation, dry run, mapping, error file, and rollback strategy.
- Export center with permissions and audit trail.
- Scheduled backups and customer-visible restore policy.
- Soft delete, retention, legal hold, and permanent deletion workflows.
- Tenant export and offboarding package.
- Disaster-recovery exercises.

## Observability and support

- Structured logs, metrics, traces, and alerting.
- Admin-visible job and integration health.
- Support console with tenant timeline and safe diagnostics.
- Status page and incident communication process.
- Feature flags and controlled rollout.
- Release notes and migration notices.

## Exit criteria

- Production SLOs are measured for at least one full pilot period.
- Backup restore is tested, not merely configured.
- Security review has no open critical or high-risk blocker.
- A support operator can diagnose auth, sync, import, automation, and billing issues without database access.

---

# Phase 6 — Scale and ecosystem

**Goal:** Turn a strong product into a repeatable enterprise business.

## Integrations

Prioritize based on customer demand and workflow leverage:

1. Google/Microsoft identity and calendars;
2. email and mailbox sync;
3. accounting exports and sync;
4. Slack or Teams notifications;
5. storage providers;
6. data warehouse/BI export;
7. selected marketing or messaging providers.

Every integration needs:

- OAuth or secure credential handling;
- scopes and consent display;
- sync direction and conflict rules;
- health status;
- replay/reconciliation;
- disconnect and data-removal behavior.

## Extensibility

- Public API versioning.
- API keys and OAuth applications.
- Webhook event catalog.
- Developer documentation and sandbox tenant.
- Custom apps or extension points.
- Marketplace only after core integration reliability is proven.

## Enterprise commercial readiness

- Plan limits and feature entitlements.
- Usage metering.
- Subscription and billing lifecycle.
- Trial, upgrade, downgrade, suspension, and cancellation workflows.
- Contract and renewal visibility.
- Customer health and adoption metrics.
- Implementation playbooks.
- Admin and user training.
- SLA and support tiers.

## Exit criteria

- Customers can adopt through a repeatable implementation process.
- At least two integrations are production-proven with monitoring and support procedures.
- API changes are versioned and documented.
- Enterprise expansion is based on usage and measurable customer outcomes.

---

# Cross-functional release gates

No phase should be considered complete based only on a successful build.

## Product gate

- A named user can complete the workflow end to end.
- Empty, loading, error, permission, and retry states are present.
- Product analytics capture success and abandonment.
- Documentation matches the actual interface.

## Engineering gate

- Unit, integration, e2e, and contract tests exist for critical paths.
- Migrations run from a clean database.
- Scope isolation is tested with positive and negative cases.
- Background work is observable and retryable.
- Performance is tested at the intended tenant size.

## Security gate

- Authorization is enforced server-side.
- Sensitive fields are protected.
- Audit events exist for security-sensitive changes.
- Secrets are not present in logs, source, or client bundles.
- Threat-model actions are closed or accepted by an accountable owner.

## Operations gate

- Monitoring and alerts exist.
- Backups and restore have been exercised.
- Support has runbooks.
- Incident ownership is clear.
- Rollback or feature-disable procedure is documented.

## Commercial gate

- Pricing and entitlements match actual product behavior.
- Sales claims are mapped to verified capabilities.
- Pilot customer references confirm the promised outcome.
- No foundation-only feature is presented as production-ready.

---

# Recommended delivery order for the next two quarters

## First 30 days

1. Freeze new module expansion.
2. Publish the capability matrix.
3. Finish the customer-to-cash vertical slice.
4. Complete the visible People & automation workflows.
5. Turn Settings / Setup into a real organization and access configuration surface.
6. Add CI, contract tests, scope tests, and production-like seed/migration checks.

## Days 31–60

1. Add RBAC permissions and department access management.
2. Add import/export and saved views.
3. Finish support and customer portal workflows.
4. Add automation run history, retries, and dead-letter handling.
5. Harden invoice/payment and period-close workflows.
6. Establish observability dashboards and support runbooks.

## Days 61–90

1. Pilot with two or three real service businesses.
2. Measure workflow completion, data import failures, support volume, and retention.
3. Close critical security and reliability findings.
4. Deliver first accounting, identity, calendar, and notification integrations.
5. Reassess which people/payroll features can be marketed and which remain foundation-only.

## Days 91–180

1. Add SSO, MFA, SCIM, audit export, and tenant lifecycle controls.
2. Complete backup/restore and disaster-recovery exercises.
3. Add load testing and scale improvements.
4. Formalize support, incident response, status communication, and release management.
5. Begin SOC 2 or equivalent control readiness if required by the target segment.
6. Convert successful pilots into referenceable production customers.

---

# Definition of production-ready enterprise CRM

ZioZen should use the following definition internally:

> **Production-ready enterprise CRM** means a customer can configure the organization, control access, import data, operate the core customer-to-cash workflow, integrate adjacent systems, automate repeatable work, audit sensitive changes, recover from failure, and obtain support—without relying on engineers to repair ordinary operations.

Until that definition is met, the product should be positioned as a **strong, department-aware CRM and operations platform in controlled rollout**, not as a complete enterprise ERP, payroll system, or universal replacement for every specialist tool.
