# ZioZen CRM Facelift Brief

## Objective
Redesign the existing React CRM into a polished enterprise operations console for department-aware staff users. Preserve existing API functionality while making information hierarchy, navigation, forms, and high-value actions feel deliberate and fast.

## Aesthetic direction
Midnight operations console: an ink-black navigation rail paired with a warm off-white workspace, acid-lime action accents, and cool blue secondary highlights. Editorial typography, compact data density, rounded-but-not-bubbly cards, thin rules, and strong numeric hierarchy. Avoid generic purple SaaS gradients.

## Core experience
- Persistent left rail with ZioZen identity, workspace navigation, status, and user controls.
- Command-style topbar with current area, department scope, search affordance, and primary action.
- Overview: KPI strip, cash exposure, delivery pulse, activity feed, prioritized work queue.
- Workspace: customers, projects, tasks with searchable dense lists.
- Sales: leads and estimates with conversion actions.
- Finance: invoices, payment state, contracts, subscriptions.
- Support: ticket queue with visible priority and safe reply actions.
- Admin/System: user, department, extensibility, audit and system health summaries.
- Modal dialogs replace browser prompts for create/payment/reply actions.

## Typography and color
Use system stack with strong condensed-feeling headings via letter spacing; avoid external font dependencies. Colors: #101512 ink, #f6f7f2 canvas, #d8ff5b lime, #6ee7f2 cyan, #ffb86b orange, #ff6b6b red, #73807a muted green-gray.

## Output
Implement in apps/web/src/App.tsx and apps/web/src/App.css using existing React/Vite conventions and API client.
