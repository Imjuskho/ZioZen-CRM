# ZioZen CRM

Clean rebuild of a department-aware CRM.

## Stack
- API: NestJS + TypeScript + Prisma
- Web: React + Vite + TypeScript
- Dev database: SQLite via Prisma
- Target production database: PostgreSQL via Docker Compose

## Local development

### API
```bash
cd apps/api
npm install
npx prisma migrate dev
npm run start:dev
```

### Web
```bash
cd apps/web
npm install
npm run dev
```

API URL defaults to `http://localhost:3000`; the web app defaults to the same. Set `VITE_API_URL` to override.

## Notes
- Legacy Perfex CRM was used only to identify business requirements and data structures. No proprietary code or license material was imported.
