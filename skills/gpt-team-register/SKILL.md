---
name: gpt-team-registration
description: Register ChatGPT Team/Business sub-accounts through the hegiw77632.cloud-ip.cc email pattern and codex SAML SSO. Use when the user asks to register another Team child account, retry a gpt-team registration, or create an account like ikun0000001 under the Team SSO flow.
---

# GPT Team Registration

Use this skill to help register ChatGPT Team/Business sub-accounts from `/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register`.

This repository serves two purposes:

- a runnable CLI script
- a reusable Codex skill

When using the skill, prefer calling the bundled script instead of re-implementing the browser flow inside the conversation.

## Fast Path Script

Prefer the bundled script for repeat registrations:

```bash
cd /Users/yangchunjiang/PersonalCode/closeai/gpt-team-register
./register-team-account ikun0000002
```

If Chrome or Chromium is not in a standard location, pass it explicitly:

```bash
./register-team-account ikun0000002 --chrome-path /path/to/chrome
```

Or configure it with environment variables:

```bash
CHROME_PATH=/path/to/chrome ./register-team-account ikun0000002
```

The script automates:

- Opening ChatGPT.
- Logging out an existing ChatGPT account if necessary.
- Entering the derived email.
- Choosing `codex` SSO.
- Filling the SAML form.
- Submitting `Sign In` automatically.
- Retrying fresh SAML requests after `invalid SAML request`.
- Selecting the default job role `工程`.
- Dismissing optional onboarding prompts.
- Saving a ChatGPT session cache with `access_token` and `session_token`.

The script is cross-platform friendly now:

- it can use `node` from `PATH`
- it can load Playwright from the current Node environment
- it can auto-detect common Chrome paths
- it can fall back to Playwright's default Chromium

The script uses a persistent browser profile at:

```text
/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/.browser-profile
```

If Cloudflare/browser verification appears, complete the visible verification manually in the opened browser, then press Enter in the terminal. The profile should remember that verification for later runs. Use `--no-persistent` only when intentionally testing a clean browser.

The script submits `Sign In` automatically by default for faster repeat registration. Pass `--confirm` only when you intentionally want a manual confirmation gate before submission.

Use `--role <name>` to choose a different onboarding role. Use `--close` to close the script browser at the end.

By default, successful runs save:

```text
/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/chatgpt_sessions/<safe-email>.json
```

This file contains secrets. Never stage, commit, paste, or print its token fields. Use `--no-save-session` only when the user explicitly does not want a local session cache.

For runtime customization, prefer these inputs before editing files:

- `NODE_BIN`
- `NODE_MODULES`
- `NODE_PATH`
- `PLAYWRIGHT_PACKAGE_PATH`
- `CHROME_PATH`
- `GOOGLE_CHROME_BIN`
- `CODEX_RUNTIME_NODE_DIR`

## Inputs

- Account id: for example `ikun0000001`.
- Email: derive as `<account-id>+@hegiw77632.cloud-ip.cc`.
- SSO User ID: exactly `<account-id>`.

If the user only provides an id, derive the email. If the user provides both, prefer the explicit values and mention them before submitting.

## Safety Boundaries

- Use the in-app Browser skill for ChatGPT and SSO pages.
- Do not bypass Cloudflare, CAPTCHA, browser safety interstitials, or paywalls. Ask the user to complete those manually if they appear.
- The default automation path submits the SSO `Sign In` button automatically.
- Pass `--confirm` when you want the script to stop and require an exact confirmation string before submission.
- Selecting onboarding preferences such as job role can be done automatically when the requested role is already known.
- Session caches and browser profiles contain secrets. Do not upload `.browser-profile/`, `chatgpt_sessions/`, `gpt-rt/`, or token JSON files.

## Browser Workflow

1. Open `https://chatgpt.com/auth/login`.

   If ChatGPT redirects to an already logged-in workspace, log out first:

   - Open the profile menu.
   - Choose `退出登录`.
   - Confirm the logout dialog.
   - If an account chooser appears, choose `创建帐户` or `登录至另一个帐户` to reach the email form.

2. Enter the email.

   Preferred email:

   ```text
   <account-id>+@hegiw77632.cloud-ip.cc
   ```

   The ChatGPT email field may fail with `Browser Use virtual clipboard is not installed` when using `fill`, `type`, or DOM CUA `type`. If that happens, click the field and input characters with `tab.cua.keypress` one character at a time.

   Character mapping for keypress fallback:

   - `@`: `SHIFT` + `2`
   - `+`: `SHIFT` + `=`
   - `.`: `.`
   - `-`: `-`
   - letters and digits: the character itself

3. Click `继续`.

4. On `https://auth.openai.com/sso`, choose the `codex` SSO option.

5. On the SAML SSO page, fill:

   - `input#email`: `<account-id>+@hegiw77632.cloud-ip.cc`
   - `input#userid`: `<account-id>`

   Use the same keypress fallback if normal fill/type fails.

6. Click `Sign In` directly.

   Optional safety gate when needed:

   ```text
   表单已填好。点击 Sign In 会提交并可能创建/登录账号。
   请回复“确认提交 <account-id>”，我再提交。
   ```

7. If `--confirm` is enabled, wait for that confirmation and then click `Sign In`.

8. Verify the result:

   - Success usually redirects to `https://chatgpt.com/`.
   - A first-run job-role screen may appear with options like `工程`, `设计`, `产品管理`, `其他`.
   - Ask the user which role to choose. If they choose `工程`, click `工程`.
   - Dismiss optional onboarding prompts such as `稍后再说` or `跳过` unless they configure a preference the user should decide.
   - Final success evidence: ChatGPT home is usable, the chat box is present, and the workspace shows the Business workspace.

9. If using the script path, verify session cache creation:

   ```bash
   node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('chatgpt_sessions/<safe-email>.json','utf8')); console.log({email:d.email, hasAccessToken:!!d.access_token, hasSessionToken:!!d.session_token, hasRawSession:!!d.raw_session})"
   ```

   Never print the actual token values.

## Codex In-App Browser Flow

Use this when the user explicitly wants Codex's in-app browser, when the script Chrome profile is locked, or when browser verification must be handled visually inside Codex.

1. Use the Browser skill and open `https://chatgpt.com/`.
2. If another account is logged in, open the profile menu, choose `退出登录`, confirm, then choose `登录至另一个帐户`.
3. Enter `<account-id>+@hegiw77632.cloud-ip.cc`.
4. Choose the `codex` SSO option.
5. Fill the SAML form:

   - `email`: `<account-id>+@hegiw77632.cloud-ip.cc`
   - `userid`: `<account-id>`

   If DOM typing fails with the virtual clipboard error, use `tab.cua.keypress` character-by-character:

   - `@`: `SHIFT` + `2`
   - `+`: `SHIFT` + `=`
   - `.`: `.`
   - `-`: `-`

6. Submit `Sign In`.
7. Complete onboarding:

   - Choose `工程` unless the user requested another role.
   - Click `稍后再说` for optional Codex/app prompts.
   - Click `跳过` for optional work app selection.

8. Verify:

   - URL is `https://chatgpt.com/`
   - Business workspace is visible
   - chat box `与 ChatGPT 聊天` is visible

9. Open `https://chatgpt.com/api/auth/session` in the same in-app browser tab and confirm the JSON has `accessToken` and `sessionToken`. Do not print either token.

10. Save the session cache by importing the local saver in Node REPL:

   ```js
   const authSession = await tab.playwright.evaluate(() => JSON.parse(document.body?.innerText || "{}"));
   const mod = await import("/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/scripts/fetch-json-save.mjs");
   await mod.saveChatgptSessionCacheFromAuthSession(authSession, {
     email: "<account-id>+@hegiw77632.cloud-ip.cc",
   });
   ```

   Then return to `https://chatgpt.com/`.

11. Verify the saved file without revealing tokens:

   ```bash
   cd /Users/yangchunjiang/PersonalCode/closeai/gpt-team-register
   node -e "const fs=require('fs'); const p='chatgpt_sessions/<safe-email>.json'; const d=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({email:d.email, hasAccessToken:!!d.access_token, hasSessionToken:!!d.session_token, hasRawSession:!!d.raw_session}, null, 2))"
   ```

## SAML Expiry Retry

The SAML request URL can expire quickly while waiting for confirmation. If clicking `Sign In` returns:

```text
invalid SAML request
```

then:

1. Return to `https://chatgpt.com/auth/login`.
2. Re-enter the same email.
3. Choose `codex` again to generate a fresh SAML request.
4. Fill the same email and User ID.
5. Submit immediately. If `--confirm` is enabled for that run, reuse the same confirmation for the retry.
6. Verify success on ChatGPT.

Do not reuse an old `SAMLRequest` or `RelayState` URL.

## Completion Report

Report:

- Account id and email used.
- Whether registration/login reached ChatGPT.
- Whether onboarding choices were applied.
- Whether session cache was saved and structurally verified.
- Any remaining prompt requiring the user, such as Cloudflare verification.

Keep the goal active until the account is registered/logged in, usable, and the session cache is saved or the user explicitly says not to save it.
