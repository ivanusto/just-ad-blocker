# Automated store publishing (Chrome Web Store + Firefox AMO)

The `Update filter rules` workflow rebuilds the rulesets weekly and, when they
change, publishes a new version. Besides the GitHub Release it now also uploads
to the Chrome Web Store and Firefox AMO.

> **Security:** all credentials live in **GitHub → repo Settings → Secrets and
> variables → Actions**. The workflow references them by name only; GitHub masks
> their values in logs. **Never paste these tokens into chat, code, or commits.**

## Prerequisites (one-time, done by you)

1. The extension must already be **registered** in each store's developer
   dashboard, with at least one version manually uploaded first:
   - Chrome Web Store Developer Dashboard (one-time US$5 developer account).
   - Firefox `addons.mozilla.org` (AMO) developer account.
2. Add the six secrets below.

## Secrets to create

| Secret name | Store | Where to get it |
|---|---|---|
| `CWS_EXTENSION_ID` | Chrome | The item ID shown in the Web Store dashboard URL / item page. |
| `CWS_CLIENT_ID` | Chrome | Google Cloud OAuth client (Desktop app) — see below. |
| `CWS_CLIENT_SECRET` | Chrome | Same OAuth client. |
| `CWS_REFRESH_TOKEN` | Chrome | Generated once from the OAuth client (see below). |
| `AMO_JWT_ISSUER` | Firefox | AMO → Manage API Keys → **JWT issuer**. |
| `AMO_JWT_SECRET` | Firefox | AMO → Manage API Keys → **JWT secret** (shown once). |

### Chrome Web Store OAuth credentials

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or reuse)
   a project and **enable the "Chrome Web Store API"**.
2. Configure the OAuth consent screen (External, your own email as a test user is
   fine for a personal publisher).
3. Create an **OAuth client ID** of type **Desktop app** → this gives you the
   `CWS_CLIENT_ID` and `CWS_CLIENT_SECRET`.
4. Generate a refresh token once. Easiest path:
   ```bash
   npx chrome-webstore-upload-cli@3 --help   # confirms the CLI is reachable
   ```
   then follow the CLI's documented "get a refresh token" flow (visit the
   consent URL with your client id, approve, exchange the returned code for a
   refresh token). Store the long-lived refresh token as `CWS_REFRESH_TOKEN`.

### Firefox AMO API keys

1. Sign in at https://addons.mozilla.org/developers/addon/api/key/
2. Generate credentials → copy the **JWT issuer** → `AMO_JWT_ISSUER`, and the
   **JWT secret** (shown only once) → `AMO_JWT_SECRET`.

## How publishing behaves

- **Chrome**: `--auto-publish` submits the new zip and requests publication.
  Google still runs automated review; it usually goes live without manual action.
- **Firefox**: `web-ext sign --channel listed` submits to AMO, which queues the
  version for review. Listed submissions are not instant.
- Both steps run **only when the rulesets actually changed** (same gate as the
  GitHub Release), so an unchanged week uploads nothing.

## Testing without waiting a week

Trigger the workflow manually from the **Actions tab → Update filter rules → Run
workflow**. If upstream lists happen to be unchanged, nothing publishes — that is
expected.
