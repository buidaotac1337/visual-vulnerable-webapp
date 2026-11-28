# AGENTS.md — Engineering Contract for AI Coding Agents

> Single Source of Truth (SSOT) governing all automated and human contributions to **Visual Vulnerable Web App (VVWA)**. Read this before creating branches, modifying files, or adding dependencies.

## 1. Repository Map & Module Boundaries

```text
visual-vulnerable-webapp/
├── core/
│   ├── backend/      # FastAPI engine (Python 3.12 via uv workspace)
│   ├── frontend/     # React + Vite + strict TypeScript + Tailwind v4 (pnpm)
│   └── postgres/     # init.sql (roles + schema) & seed.sql (reset data)
├── labs/             # Isolated educational vulnerability labs (student-facing)
├── docs/             # Architecture, specs, UI/UX, Design System, and ADRs
├── scripts/          # Modular quality checkers & unified gate runner
└── .github/          # Path-filtered CI workflows & PR template
```

* **`core/` vs `labs/` separation:** Infrastructure belongs in `core/`. Student-editable vulnerable/secure lab logic belongs exclusively in `labs/<id>-<slug>/`.
* **Security isolation rule:** Intentional vulnerabilities are **strictly forbidden** anywhere outside `labs/<id>/backend/vulnerable.py` and `labs/<id>/frontend/vulnerable.tsx` (the optional frontend sink file, see [ADR-0006](docs/adr/0006-frontend-sink-grading-and-verify-matchers.md)). `LabView.tsx`, `secure.*`, and all of `core/` must stay free of intentional sinks.
* **Lab session identity:** Handlers that need the logged-in user declare a `ctx` parameter and read `ctx.actor`; never derive identity from `payload` in `secure.py` (see [ADR-0005](docs/adr/0005-lab-session-actor-context.md)).

## 2. Non-Negotiable Code Quality Rules

1. **Max 350 Lines per File (Hard Limit):**
   * Every `.py`, `.ts`, `.tsx`, `.css`, and `.sql` file under `core/`, `labs/`, and `scripts/` MUST stay `<= 350` lines (warning triggers at `> 280` lines). Split cohesive responsibilities early.
2. **SRP, SOLID, DRY, SSOT:**
   * Keep routers thin, move domain logic into focused services, centralize schemas/constants in one place (SSOT), and keep McCabe complexity `<= 10`.
3. **Mandatory Barrel Imports:**
   * **Python:** Every package under `core/backend/app/*` and `scripts/quality` MUST expose `__init__.py` with an explicit `__all__`. Never bypass a sibling package's barrel (e.g., use `from app.schemas import HealthResponse`, NOT `from app.schemas.health import HealthResponse`).
   * **Frontend (TypeScript):** Every module folder under `core/frontend/src/{components,hooks,lib,types}` MUST expose `index.ts`. Import via barrel aliases (`@/components`, `@/hooks`, `@/lib`, `@/types`); deep imports (`@/components/foo/bar`) are blocked by ESLint.
4. **Full Type Hinting & Docstrings:**
   * **Python:** Must pass `mypy --strict` and Ruff `ANN` (all params/returns typed) + `D` (Google-style docstrings on modules, classes, and functions).
   * **Frontend:** Must pass `tsc --noEmit` (`strict: true`, `noUncheckedIndexedAccess: true`), ESLint `explicit-function-return-type`, and JSDoc/TSDoc on exported symbols.
5. **Design Tokens SSOT ([ADR-0012](docs/adr/0012-atlassian-style-design-tokens.md)):**
   * Colours, type sizes and radii come only from `core/frontend/src/styles/tokens/` (purpose utilities such as `text-subtle`, `bg-danger-bold`, `border-input`; status colours via `@/lib` tones). Colour literals live only in `tokens/palette.css`.
   * Never use Tailwind's default palette, the removed `danger/safe/warning/info/brand-50…950` scales, `white`/`black`, arbitrary colour/font-size/spacing values, or inline `fontFamily`; ESLint and the `design-tokens` check in the `frontend` gate block them.
6. **Exact Version Pinning:**
   * **Python (`uv`):** Pin exact versions (`==`) in `pyproject.toml` and update `uv.lock` via `uv lock`.
   * **Frontend (`pnpm`):** Use exact versions (no `^` or `~`) with `pnpm-lock.yaml`.
   * **Docker & CI:** Pin explicit version tags; never use `:latest`.

## 3. Branching & Commit Rules

* **Never commit directly to `main`.** Always create a task branch first:
  * Pattern: `<type>/<short-kebab-slug>`
  * Allowed `<type>`: `feat`, `fix`, `lab`, `docs`, `refactor`, `chore`, `ci`, `adr`
  * Example: `lab/01-sql-injection`, `feat/source-reader`, `docs/update-wireframe`
* **Conventional Commits required:**
  * Format: `<type>(<optional-scope>): <concise summary <= 72 chars>`
  * Example: `feat(backend): add lab loader auto-discovery`

## 4. Quality Gate Matrix (Run Before Every Commit / PR)

Use the unified CLI (`uv run python scripts/gates.py --auto`) to run only the exact gates required by your changes:

| Change Type | Example Paths | Required Gates |
| :--- | :--- | :--- |
| **Docs-only (no logic impact)** | `docs/**`, `*.md`, `LICENSE` | `hygiene`, `docs` |
| **Backend / Lab Python / Scripts** | `core/backend/**`, `labs/*/backend/**`, `labs/*/meta.json`, `scripts/**`, `pyproject.toml`, `uv.lock` | `hygiene`, `backend` |
| **Frontend / Lab UI** | `core/frontend/**`, `labs/*/frontend/**` | `hygiene`, `frontend` |
| **Infra / Database / CI** | `docker-compose.yml`, `**/Dockerfile`, `core/postgres/**`, `.github/**` | `hygiene`, `infra` |

Explicit manual invocations:
* `uv run python scripts/gates.py --auto`
* `uv run python scripts/gates.py --gate docs`
* `uv run python scripts/gates.py --gate backend`
* `uv run python scripts/gates.py --gate frontend`
* `uv run python scripts/gates.py --gate infra`
* `uv run python scripts/gates.py --gate all`

## 5. ADR (Architecture Decision Record) Policy

Create a new ADR in [docs/adr/](docs/adr/README.md) using [0000-template.md](docs/adr/0000-template.md) and register it in `docs/adr/README.md` whenever a change:
* Adds, replaces, or removes a framework, database, package manager, or core library.
* Modifies the FastAPI trace contract, `meta.json` schema, or `# @step` / `# @snippet` syntax.
* Changes directory boundaries, barrel conventions, PostgreSQL privilege isolation, or Quality Gate thresholds.
