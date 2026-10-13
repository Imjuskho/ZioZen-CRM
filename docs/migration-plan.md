# Migration Plan: Perfex CRM -> ZioZen CRM

## Phase 0: Freeze and backup
- Take full database and file backups.
- Stop new customization on legacy CRM.

## Phase 1: Data export
- Export users, departments, memberships, customers, projects, tasks.
- Validate counts and department assignment.

## Phase 2: Read-only parallel run
- Run ZioZen CRM beside legacy CRM.
- Validate department visibility and reports.

## Phase 3: Transactional cutover
- Migrate one department at a time.
- Keep legacy CRM read-only for 30-90 days.

## Phase 4: Retire legacy
- Remove world-writable files and old deploy artifacts.
- Archive legacy data in cold storage.
