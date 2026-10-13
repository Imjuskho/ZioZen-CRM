# ZioZen CRM Domain Model

ZioZen CRM is a clean-room rebuild of a department-aware CRM. It is intentionally rebuilt from business requirements, not from proprietary CRM or add-on source.

## Core entities
- User: authentication, role, active state.
- Department: business unit, branding metadata.
- UserDepartment: many-to-many membership with `isPrimary`.
- Customer: contact/company, scoped to one department and optional owner.
- Project: scoped to one department, optional customer/owner.
- Task: scoped to one department, optional project, assignee, customer.

## Access rules
- `ADMIN` may access all departments.
- Other roles may only access resources whose `departmentId` is in their `UserDepartment` memberships.
- Every read and write enforces department access at the service layer.
- Cross-department access is denied with `403 Forbidden`.

## Security principles
- Credentials and DB URLs come from environment variables only.
- Uploads use signed URLs, never execute scripts.
- Audit logs for access and changes are expected on sensitive actions.
- No world-writable application files.
