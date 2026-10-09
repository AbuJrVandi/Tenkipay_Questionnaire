# TenkiPay Agent Workspace

A questionnaire and dashboard for maintaining existing TenkiPay agent outlet profiles and reviewing their operational experience.

**Ready to put it online?** Follow [DEPLOYMENT.md](DEPLOYMENT.md).

## What you can do

- Share the questionnaire by link or QR code.
- Collect responses and mandatory GPS locations.
- Create an Adrehs address with the respondent?s permission.
- Edit question wording and pause response collection.
- Review responses and questionnaire analytics.
- Download Excel, CSV and JSON files.

## Start on this computer

Open PowerShell in the project folder and run:

```powershell
.\scripts\start-local.ps1
```

Keep the terminal open while using the system. Local testing now uses SQLite, so MySQL does not need to be running. You can also use `npm run dev`. Use Node.js 24 or newer.

If the workspace is already running, the startup command prints its links and exits successfully. If a port is occupied by another process or an incomplete instance, close the previous development terminal and retry.

| Page | Local address |
| --- | --- |
| Admin dashboard | http://localhost:5173/admin |
| Respondent form | http://localhost:5173/form |

**Local test login:** `test@tenkipay.test` / `password123`.

These credentials are for local testing. Choose a strong password when deploying.

## Use the dashboard

1. Sign in to the admin dashboard.
2. Open **Questionnaire**, select a section, and choose **Add question to this section**. Enter wording, select a question type, add choices when applicable, and set **Required** if needed. Select **Save changes** to update the live form. Existing template rules still apply; questions in sections B–E are shown to interested participants, while section F handles follow-up contact.
3. Select **Share form** to copy the respondent link or download its QR code.
4. Open **Responses** to see submitted answers and location codes.
5. Open **Analytics** to explore the charts. Filters apply to the results.
6. Select **Export data** to download the filtered responses.

Respondents see only the form. They do not need an admin login.

Use `/form` for a saved submission. `/form?preview=1` is preview only and never saves a response. On the Responses page, **Show latest** returns to page 1; search/date/district filters can hide records. Refresh the dashboard or select **Show latest** after submission. Responses and analytics read the same saved SQLite data; there is no timed refresh.

Responses are read-only. Delete an individual response using its **Delete** button or its detail view. Select rows and use **Delete selected** for multiple responses; the header checkbox selects the current page. Deletion requires confirmation, is permanent, is recorded in the audit log, and updates analytics. It does not delete the public address from Adrehs.

In the Questionnaire editor, existing questions support wording and help-text edits. Ordinary questions also support type, answer-choice and Required changes. Select **Delete question**, confirm, then **Save changes**; Undo is available before saving. Participation, interest and mandatory GPS questions are protected. Questions used by branching cannot be deleted until their dependent questions are removed. Earlier responses retain their original questionnaire version.

## Location capture

Selecting **Yes** to participation starts GPS capture. A valid reading is required to continue. The browser must have location permission. Respondents should complete the form at their proposed outlet.

The current **Agent Network Profile and Experience Questionnaire** uses seven sections (A–G), reporting-period skip rules, revenue collection details, repeatable institution rows, operational experience, support and verification. GPS remains mandatory immediately after participation consent; the draft's optional question 37 is covered by this existing location flow. A calculated daily revenue average is stored separately from a typical-day estimate. Earlier applications remain accessible through their original versions.

The deployed server automatically upgrades the legacy questionnaire to the existing-agent network template on startup. The release creates a new version, preserves collection status and historical responses, and is recorded once so subsequent deploys retain administrator edits. The Overview and Analytics layouts follow the saved template. See [Render deployment and updates](DEPLOYMENT.md#render-deployment-and-updates) for the production commands and how database edits differ from source releases.

Adrehs registration has a separate public-location permission. Select **Create Adrehs code** to register the captured point. The returned code and location details are stored with the submitted response and included in exports. The registry entry can exist even if the respondent later abandons the form.

After the respondent confirms the captured outlet point and public registry permission, the server calls Adrehs and immediately saves its returned code, address/place name (where available), coordinates and administrative areas in `adrehs_registrations`. Submission verifies this registration against the captured point and links the saved details to the response. Changing GPS coordinates clears the previous code. The interface distinguishes GPS capture, address registration, and questionnaire submission; it reports registration or storage failures explicitly.

Questions use consecutive numbers in their saved order. Conditional questions keep their assigned numbers when skipped. Adding or deleting questions renumbers the next saved version; earlier responses keep their original numbering. Run `node scripts/update-location-numbering.mjs` on an existing installation to add registration storage and update the current questionnaire numbering.

**Phones need a reachable HTTPS form address for GPS capture.** A localhost QR code opens only on the computer running the application. See the deployment guide before sharing publicly.

## Local SQLite database

Local `.env` uses `DB_DRIVER=sqlite` and `SQLITE_PATH=.local/tenkipay.sqlite`. The API saves questionnaires, responses, Adrehs registrations and accounts in this file. Open it with a SQLite database viewer to inspect it; MySQL Workbench cannot open SQLite files. Keep `.local/` private and back up the database with the application stopped, including any remaining `-wal` and `-shm` files.

Existing MySQL data was copied to SQLite for this local installation. The original MySQL database was left intact and is no longer used locally. `node scripts/migrate-local-sqlite.mjs` performs a verified one-time copy on another configured MySQL installation and refuses to overwrite a populated SQLite database.

Production uses the configured MySQL database for questionnaires, published versions, responses, accounts and Adrehs registrations. Set `DB_DRIVER=mysql` and the `MYSQL_*` settings on the host; SQLite is restricted to development. Startup creates missing tables before accepting requests and preserves existing data. See the deployment guide before publishing.

## Project files

| Folder or file | Purpose |
| --- | --- |
| `src/` | React form and dashboard |
| `server/` | API, authentication, database and exports |
| `shared/questionnaire.js` | Questionnaire rules and validation |
| `public/tenkipay-logo.png` | TenkiPay logo |
| `.env` | Private local settings |
| `.env.example` | Settings template |
| `tests/` | Automated checks |
| `DEPLOYMENT.md` | Instructions for going online |

## Useful commands

For local demonstrations, `node scripts/seed-demo-responses.mjs` adds 48 validated, labelled sample responses across the districts. It preserves existing data and does not duplicate its dataset when rerun. Names, contacts and GPS are fictional; it never creates public Adrehs addresses. Demo responses are included in analytics and can be deleted through the normal response controls.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependencies |
| `npm run dev` | Start local development with configured database |
| `npm test` | Check questionnaire rules |
| `npm run db:setup` | Initialize a configured database with a strong admin password |
| `npm run build` | Build the website |
| `npm start` | Serve the built website and API |

Keep `.env` and `.local/` private. Do not upload them to a public repository.
