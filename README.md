# Projet Note

A community case-management app with a French interface, built with Hono, Better Auth and Cloudflare Workers/D1. It runs locally without a Cloudflare account.

## Start with fictional data

Use Node.js 24 and npm:

```sh
git clone https://github.com/CallMeBack-514/Projet-Note-.git
cd Projet-Note-/suivi-communautaire
npm ci
npm run demo:setup
npm run dev
```

Open **http://localhost:5173**. Sign in as `a@demo.example` (intervenant) or `s1@demo.example` (superviseur), using the generated password in `suivi-communautaire/.local/credentials.json` (relative to the repository root). All seven demo accounts share that password on your machine; it is generated locally, not committed.

The setup creates two fictional organizations, seven staff accounts and eight sample cases. It applies local migrations and generates the local authentication secret. Rerunning it preserves passwords, existing cases, transfers and disabled accounts.

| Account | Role | Initial sample cases |
| --- | --- | --- |
| `a@demo.example` | Intervenant, Camille’s team | 3 |
| `b@demo.example` | Intervenant, Camille’s team | 2 |
| `c@demo.example` | Intervenant, Alex’s team | 2 |
| `s1@demo.example`, `s2@demo.example` | Superviseurs, Maison des liens | All 7 in their organization |
| `d@demo.example` | Intervenant, Le Trait d’union | 1 |
| `s3@demo.example` | Superviseur, Le Trait d’union | Its 1 case |

Try transferring Anne Beaulieu’s fictional housing case from Émilie (`a`) to Sofia (`c`). Émilie loses access, Sofia gains it, and both supervisors in their organization can still see it. Accounts in the other organization cannot access it.

The editable dataset is [scripts/demo-data.json](suivi-communautaire/scripts/demo-data.json). All people and contact details in it are fictional; email addresses use `.example`. Stable IDs prevent duplicates on reruns. Changing an existing fixture does not overwrite a seeded case; use a new ID to add a sample. The seed command targets local D1 only and does not upload data or deploy the app.

The current app supports cases, assignment and transfers. Notes, document templates, Active/Inactive status, the supervisor dashboard and the history UI are planned in [OpenSpec](openspec/changes); this dataset does not imply those features are implemented.

See the [application README](suivi-communautaire/README.md) for all accounts, permissions, tests and detailed setup. Local credentials, databases, dependencies and test output are excluded from Git.
