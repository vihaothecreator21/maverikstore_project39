# Review And Audit Index

## Purpose

This folder summarizes historical audits and review reports. Full old reports are preserved under `../99-archive/`.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Architecture audit | Archived/resolved | Old findings are mostly reflected in current layered backend |
| Code review 1.5 | Archived/resolved | Historical bug review for order/payment logic |
| Auth/admin analysis | Archived | Useful for learning RBAC flow, but some details are older than current code |
| Order module bug report | Archived | Critical issues such as audit transaction and enum payment status have been addressed in current code |

## Known Active Issues To Re-check

- `.env.example` may not match `env.config.ts`.
- Review/favorites models exist but routes are not implemented/mounted.
- Frontend API base URL logic is duplicated across modules.
- Admin vendor scripts in HTML are non-module scripts; Vite build warns but passes.
- Some legacy docs had encoding artifacts; use current files outside archive for active guidance.

## How To Use Archived Reports

1. Start with current module docs in `02-features/`.
2. If you need historical reasoning, inspect `99-archive/`.
3. Do not treat archived TODO checklists as current truth unless verified against code.
4. When a new review is done, add a short summary here and place the full report in a dated subfolder.
