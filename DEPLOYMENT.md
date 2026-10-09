# Deploy TenkiPay

This guide takes the local application online so people can open the form on their phones and scan its QR code.

## 1. What you need

- A host that runs a **Node.js server**, with Node.js 24 or newer. Node.js 24 is used locally.
- A **MySQL 8** database.
- A public domain with **HTTPS**.
- Outbound HTTPS access from the server to `api.adrehs.org`.

The React website and Express API run together. A static-only host or a MySQL Workbench installation alone cannot run the whole application. Workbench is a database management tool.

For the simplest setup, choose a host that provides HTTPS, a Node.js service and a MySQL database. The steps below work with those services without requiring a particular provider.

## 2. Upload the application

Upload the source files, including `package.json`, `package-lock.json`, `src/`, `shared/`, `server/`, `public/`, `scripts/`, `tests/`, `index.html` and `vite.config.js`.

**Exclude:** `.env`, `.local/`, `node_modules/` and local credentials. Do not run the local bootstrap or local migration scripts on production. The host installs dependencies itself.

## 3. Create the database

This guide uses MySQL hosting. Set `DB_DRIVER=mysql` in the hosted environment; the local `.env` uses SQLite and must not be uploaded.

In your host?s database panel:

1. Create a MySQL database named `tenkipay`, using `utf8mb4`.
2. Create a user with access to that database.
3. Save the host, port, username and password for the next step.
4. Allow the application server to connect to the database.

If managing MySQL directly, run this as a database administrator and replace the password:

```sql
CREATE DATABASE tenkipay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tenkipay'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_DATABASE_PASSWORD';
GRANT ALL PRIVILEGES ON tenkipay.* TO 'tenkipay'@'localhost';
```

The SQL example assumes the application and MySQL run on the same server. For a separate database host, use the provider?s user and network configuration.

## 4. Set production settings

Use the host?s private environment-variable settings, or a private `.env` file on the server. Replace every example value below:

```dotenv
NODE_ENV=production
PORT=3001
APP_ORIGIN=https://survey.your-domain.com
VITE_PUBLIC_FORM_URL=https://survey.your-domain.com/form

MYSQL_HOST=your-database-host
MYSQL_PORT=3306
MYSQL_DATABASE=tenkipay
MYSQL_USER=tenkipay
MYSQL_PASSWORD=your-strong-database-password
MYSQL_SSL=false

ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-unique-password-at-least-14-characters

TRUST_PROXY=false
ADREHS_CREATE_URL=https://api.adrehs.org/addresses/generate
ADREHS_API_KEY=
```

| Setting | What to enter |
| --- | --- |
| `PORT` | The port required by your host; the application reads it at startup |
| `APP_ORIGIN` | The exact public HTTPS origin, with no `/form` path or trailing slash |
| `VITE_PUBLIC_FORM_URL` | The complete public form URL; set it before building |
| `MYSQL_*` | Your production database connection details |
| `MYSQL_SSL` | `true` if your provider requires verified database TLS; otherwise `false` |
| `ADMIN_EMAIL` | The administrator email for the new database |
| `ADMIN_PASSWORD` | A unique password of at least 14 characters |
| `TRUST_PROXY` | `true` only when exactly one trusted reverse proxy sits in front of Express |
| `ADREHS_API_KEY` | Leave empty unless Adrehs supplies a key for your integration |

Do not use the local `password123` login in production. Confirm the host?s proxy arrangement before setting `TRUST_PROXY`; it affects client IP detection and rate limiting.

## 5. Install, initialize and build

Run these commands from the project directory, in order:

```sh
npm ci
npm run db:setup
npm test
npm run build
```

`db:setup` creates the tables, initial questionnaire and administrator. It does not create the database itself. If tables already exist, it preserves responses and existing admin passwords.

**Changing `ADMIN_PASSWORD` later does not reset an existing account.** Use a new administrator email with `db:setup` to create a new account, or have the database administrator perform a deliberate password reset. Do not reuse a local database containing the test account without removing or replacing that account.

For a host with build/start settings:

- **First-time initialization:** run `npm run db:setup` as a release task or one-time server command.
- **Build command:** `npm ci && npm test && npm run build`.
- **Start command:** `npm start`.

Install development dependencies during the build because Vite is needed. If the host automatically omits them, use `npm ci --include=dev`.

## 6. Start and connect HTTPS

Run:

```sh
npm start
```

Configure the host to keep the process running and restart it after failures or server restarts. Point the HTTPS domain to this service. Forward website and `/api` requests to the same application port.

The application serves `dist/` and the API together. HTTPS is provided by your host or reverse proxy. Do not expose MySQL directly to the public internet.

## 7. Check before sharing

Open the public website and verify:

- `/api/health` returns `status: ok` and `database: connected`.
- `/admin` accepts your production administrator login.
- `/form` shows the centered logo and questionnaire, without a navbar or footer.
- Participation consent starts GPS capture on a phone. Denying location prevents continuing.
- With public-location permission, Adrehs returns a code for the actual captured point.
- A completed response appears in **Responses**, including GPS and the returned code.
- Charts update and Excel, CSV and JSON exports download.
- **Share form** shows the public HTTPS URL. Scanning its QR code opens the form on a phone.

Use a real, authorised location when testing Adrehs creation. Creation may add it to the public registry.

## 8. Share the form

In the dashboard, select **Share form**. Copy the link or download the QR code PNG for posters and messages.

If you change the public domain, update `APP_ORIGIN` and `VITE_PUBLIC_FORM_URL`, rebuild, restart, and regenerate any QR codes you distribute.

## Keep the system running

- Schedule MySQL backups and test restoring them. Dashboard exports do not include all application tables.
- Keep questionnaire versions when restoring data so older answers retain their wording.
- Save application logs and monitor `/api/health`.
- Before an update, back up the database, install dependencies, run tests, build and restart.
- This is an online form: respondents need internet to submit and register with Adrehs.

## Common problems

| Problem | What to check |
| --- | --- |
| Phone cannot open the QR link | Use the public HTTPS URL rather than localhost |
| GPS is unavailable | HTTPS, phone location services and browser location permission |
| Database is unavailable | Database service, `MYSQL_*` values, network access and required TLS |
| Requests return ?origin is not allowed? | `APP_ORIGIN` must exactly match the website?s HTTPS origin |
| Login fails after changing `.env` | Existing account passwords are preserved by `db:setup` |
| Form URL returns 404 | Build `dist/` before starting the server; route requests to Express |
| Adrehs creation fails | Server internet access, API response and Sierra Leone location coverage |
| QR still uses the old address | Set `VITE_PUBLIC_FORM_URL`, rebuild and generate a new QR |

## Current status

The application is built and tested locally. A public deployment has not been configured. Hosting, production MySQL, a domain and HTTPS are still needed before public sharing.
