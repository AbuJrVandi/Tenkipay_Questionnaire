# TenkiPay Agent Workspace

A clean questionnaire and dashboard for collecting and reviewing TenkiPay agent applications.

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

Keep the terminal open while using the system. If PostgreSQL is already running and `.env` is configured, you can also use `npm run dev`.

| Page | Local address |
| --- | --- |
| Admin dashboard | http://localhost:5173/admin |
| Respondent form | http://localhost:5173/form |

**Local test login:** `test@tenkipay.test` / `password123`.

These credentials are for local testing. Choose a strong password when deploying.

### Local database

The application uses PostgreSQL 14 or newer. Copy `.env.example` to `.env` and set `DATABASE_URL` to a database the application can use, then run `npm run db:setup`. To create a local role and database automatically, run `npm run db:bootstrap` first (set `PG_ADMIN_URL` if your PostgreSQL administrator account is not the default).

## Use the dashboard

1. Sign in to the admin dashboard.
2. Open **Questionnaire** to edit wording or pause collection. Select **Save changes**.
3. Select **Share form** to copy the respondent link or download its QR code.
4. Open **Responses** to see submitted answers and location codes.
5. Open **Analytics** to explore the charts. Filters apply to the results.
6. Select **Export data** to download the filtered responses.

Respondents see only the form. They do not need an admin login.

## Location capture

Selecting **Yes** to participation starts GPS capture. A valid reading is required to continue. The browser must have location permission. Respondents should complete the form at their proposed outlet.

Adrehs registration has a separate public-location permission. Select **Create Adrehs code** to register the captured point. The returned code and location details are stored with the submitted response and included in exports. The registry entry can exist even if the respondent later abandons the form.

**Phones need a reachable HTTPS form address for GPS capture.** A localhost QR code opens only on the computer running the application. See the deployment guide before sharing publicly.

## View the database in pgAdmin or psql

Create a PostgreSQL connection:

| Setting | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `tenkipay` |
| Username | `tenkipay` |
| Password | The password in `DATABASE_URL` from your local `.env` |

With `psql`, connect using the URL directly:

```sh
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
```

pgAdmin and psql view the same database used by the application. Its password is different from the dashboard login.

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

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependencies |
| `npm run dev` | Start local development; PostgreSQL must be running |
| `npm test` | Check questionnaire rules |
| `npm run db:bootstrap` | Create a local PostgreSQL role and database |
| `npm run db:setup` | Initialize a configured database with a strong admin password |
| `npm run build` | Build the website |
| `npm start` | Serve the built website and API |

Keep `.env` and `.local/` private. Do not upload them to a public repository.
