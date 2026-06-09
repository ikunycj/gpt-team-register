---
name: gpt-team-registration
description: Register ChatGPT Team/Business sub-accounts with the configured email suffix and codex SAML SSO. Use when the user asks to register another Team child account, retry a gpt-team registration, or create an account like ikun0000001/testikun0001 under the Team SSO flow. This skill must use the Codex in-app Browser, never external Chrome or the CLI browser automation script.
---

# GPT Team Registration

Use this skill to register ChatGPT Team/Business sub-accounts from:

```text
/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register
```

## Mandatory Browser Rule

Always use the Codex in-app Browser for the registration flow.

Do not use:

- external Chrome
- Playwright launched from the shell
- `./register-team-account`
- `.browser-profile`

The only shell/Node use allowed during registration is read-only verification or saving the session cache after the in-app browser has successfully logged in.

## Configuration

Before deriving an email, read:

```text
/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/skills/gpt-team-register/config.json
```

Current configurable value:

- `email_suffix`: suffix appended to the account id. Default: `+@hegiw77632.cloud-ip.cc`

Derive the email as:

```text
<account-id><email_suffix>
```

For example, with the default config:

```text
testikun0001 -> testikun0001+@hegiw77632.cloud-ip.cc
```

If the user explicitly provides an email, use the explicit email and mention it before submitting. The SSO User ID is always the account id unless the user explicitly provides another User ID.

## In-App Browser Flow

1. Use the Browser skill and connect to the Codex in-app Browser.
2. Show the browser when Cloudflare, browser verification, or manual user action may be needed.
3. Open `https://chatgpt.com/auth/login`.
4. If another ChatGPT account is logged in, log out first, then return to the email login form.
5. Enter the derived email.
6. Click `继续`.
7. On `https://auth.openai.com/sso`, choose `codex`.
8. On the SAML SSO page, fill:

   - Email: derived email
   - User ID: account id

9. Submit `Sign In` immediately.
10. Complete onboarding:

   - choose `工程` unless the user requested another role
   - dismiss optional prompts with `稍后再说` or `跳过`

11. Verify ChatGPT is usable:

   - URL is `https://chatgpt.com/`
   - Business workspace is visible
   - chat box is visible

## Typing Fallback

The in-app Browser may fail with:

```text
Browser Use virtual clipboard is not installed
```

When that happens, click the field and input characters with `tab.cua.keypress` one character at a time:

- `@`: `SHIFT` + `2`
- `+`: `SHIFT` + `=`
- `.`: `.`
- `-`: `-`
- letters and digits: the character itself

Use this fallback for both the ChatGPT email field and the SAML form fields.

## Safety Boundaries

- Do not bypass Cloudflare, CAPTCHA, browser safety interstitials, or paywalls.
- If Cloudflare or browser verification appears, ask the user to complete it in the visible in-app Browser, then continue.
- If the in-app Browser policy blocks a URL such as `external.auth.openai.com`, stop and ask the user to manually continue until the next reachable page, usually the SAML form or ChatGPT home.
- Do not use external Chrome as a fallback.
- Session cache files contain secrets. Do not print token values, stage token files, or paste token JSON.

## Saving The Session Cache

After successful login, open this URL in the same in-app Browser tab:

```text
https://chatgpt.com/api/auth/session
```

Confirm the JSON has `accessToken` and `sessionToken`. Do not print either token.

Save the session cache with the local saver:

```js
const authSession = await tab.playwright.evaluate(() => JSON.parse(document.body?.innerText || "{}"));
const mod = await import("/Users/yangchunjiang/PersonalCode/closeai/gpt-team-register/scripts/fetch-json-save.mjs");
await mod.saveChatgptSessionCacheFromAuthSession(authSession, {
  email: "<derived-email>",
});
```

Then return to `https://chatgpt.com/`.

Verify the saved file without revealing tokens:

```bash
cd /Users/yangchunjiang/PersonalCode/closeai/gpt-team-register
node -e "const fs=require('fs'); const p='chatgpt_sessions/<safe-email>.json'; const d=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify({email:d.email, hasAccessToken:!!d.access_token, hasSessionToken:!!d.session_token, hasRawSession:!!d.raw_session}, null, 2))"
```

## SAML Expiry Retry

The SAML request URL can expire quickly. If `Sign In` returns:

```text
invalid SAML request
```

then:

1. Return to `https://chatgpt.com/auth/login`.
2. Re-enter the same derived email.
3. Choose `codex` again to generate a fresh SAML request.
4. Fill the same email and User ID.
5. Submit immediately.

Do not reuse an old `SAMLRequest` or `RelayState` URL.

## Completion Report

Report:

- account id and email used
- whether registration/login reached ChatGPT
- whether onboarding choices were applied
- whether session cache was saved and structurally verified
- any remaining user action required

Keep working until the account is registered/logged in, usable, and the session cache is saved, unless the user explicitly says not to save it.
