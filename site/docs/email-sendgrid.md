# Email through SendGrid: setup, testing and upkeep

The website sends five kinds of email, all through SendGrid:

| When | To | From / reply-to | SendGrid category |
|---|---|---|---|
| A landing-page form is submitted | Jennifer (`CONTACT_TO_EMAIL`) | from `noreply@` · reply goes **to the visitor** | `lead-notify` |
| …and the visitor's thank-you (with the guide link) | the visitor | from `noreply@` · reply goes to `support@` | `lead-ack` |
| The Contact form is submitted | Jennifer | from `noreply@` · reply goes **to the visitor** | `contact-notify` |
| …and the visitor's thank-you | the visitor | from `noreply@` · reply goes to `support@` | `contact-ack` |
| "Forgot your password?" on `/login` | the dashboard user | from `noreply@` · reply goes to `support@` | `password-reset` |

So when Jennifer hits **Reply** on a notification, she's writing straight back to the person who filled in the form. And when a visitor replies to their thank-you, it lands in `support@`, not in the `noreply@` void.

All the sending code lives in `src/lib/mail.ts`. Every message goes out with a plain-text version and with SendGrid's click and open tracking **off**. Click tracking rewrites links, which breaks one-time password-reset links and makes links look like phishing.

---

## 1. SendGrid account: what's done and what's left

You've already verified `noreply@` and `support@` as **Single Senders**. That's enough for SendGrid to *accept* the mail. Here's what's left so that Gmail and Outlook *trust* it:

- [ ] **Authenticate the domain** (most important). Single Sender verification is like SendGrid checking that you own the mailbox. Domain authentication is like putting your official letterhead and a notary's stamp on every envelope. Inbox providers check the stamp, not the mailbox. Without it, mail is signed by `sendgrid.net` rather than `eichenbergassociates.com`, DMARC alignment fails, and the messages that matter most (new leads) are the likeliest to land in spam.
  1. SendGrid → **Settings → Sender Authentication → Authenticate Your Domain**.
  2. DNS host: pick wherever `eichenbergassociates.com`'s DNS lives (GoDaddy, Cloudflare, …). Domain: `eichenbergassociates.com`. Leave **automated security on**.
  3. SendGrid shows three CNAME records (`em####`, `s1._domainkey`, `s2._domainkey`). Add them at the DNS host exactly as shown. Many hosts append the domain automatically, so enter `s1._domainkey`, not `s1._domainkey.eichenbergassociates.com.eichenbergassociates.com`.
  4. Back in SendGrid, click **Verify**. DNS can take from minutes up to 48 hours.
  5. You **don't** need to change the domain's existing SPF record. With automated security on, SendGrid handles SPF on its own `em####` subdomain. Leave Jennifer's normal mailbox records (Microsoft 365 / Google) alone.
- [ ] **Add a DMARC record** if there isn't one yet. First check whether a TXT record named `_dmarc` already exists (there should only ever be one):
  ```
  Name:  _dmarc
  Type:  TXT
  Value: v=DMARC1; p=none; rua=mailto:support@eichenbergassociates.com
  ```
  Start at `p=none` (monitor only). After 2–4 weeks of reports showing everything passes, move to `p=quarantine`. Gmail and Yahoo now expect a DMARC record from any domain that sends automated mail.
- [ ] **Create the API key.** Settings → **API Keys → Create API Key** → *Restricted Access* → **Mail Send: Full Access**, everything else *No Access*. Name it `website-production`. SendGrid shows it **once**, so paste it straight into Replit Secrets. Create a second key, `website-workspace`, for the Replit workspace, so either one can be revoked without touching the other.
  - Only if you later set `NEWSLETTER_PROVIDER=sendgrid` does the key also need *Marketing: Full Access*.
- [ ] **Two-factor authentication** on the SendGrid login, and add other people as **Teammates** rather than sharing the password.
- [ ] **Check the plan.** SendGrid's free tier is a time-limited trial on newer accounts. Confirm under *Settings → Account Details → Your Products* that the account won't stop sending when the trial ends. The site's volume is tiny, so the cheapest paid tier is plenty.
- [ ] Link branding: **not needed**, because the site turns click tracking off. Revisit only if you start sending marketing campaigns from SendGrid.

## 2. Replit Secrets

Set these in **both** places: the workspace (padlock icon → Secrets) **and** the deployment (*Deployments → your Autoscale deployment → Settings/Secrets*). The deployment doesn't inherit workspace Secrets automatically. After changing them, restart the workspace (Stop → Run) and **redeploy** the deployment.

| Secret | Value | Notes |
|---|---|---|
| `SENDGRID_API_KEY` | `SG.…` | Workspace key in the workspace, production key in the deployment. No quotes, no spaces. |
| `CONTACT_FROM_EMAIL` | `noreply@eichenbergassociates.com` | Must exactly match a verified sender (or the authenticated domain). |
| `CONTACT_FROM_NAME` | `Eichenberg & Associates` | What people see next to the address. |
| `CONTACT_REPLY_TO` | `support@eichenbergassociates.com` | Must be a real inbox someone reads. |
| `CONTACT_TO_EMAIL` | `jennifer@eichenbergassociates.com` | One address that receives new-lead and new-inquiry notifications. If unset, the site's contact email (Website content → Site) is used. |
| `SENDGRID_SANDBOX` | *(unset)*, or `true` in the workspace while experimenting | `true` = SendGrid checks the request but delivers nothing. **Never set it in the deployment.** |
| `RESEND_API_KEY` | **delete it** once SendGrid works | Only used as a fallback when there's no SendGrid key. |

Optional: `NEWSLETTER_PROVIDER=sendgrid` and `SENDGRID_LIST_ID` add Insights-page sign-ups to a SendGrid Marketing list. Sign-ups are always saved in the dashboard regardless.

## 3. Testing it, step by step

1. **Configuration check.** Sign in → **Dashboard → Settings → Email delivery**. The panel should read *Provider: SendGrid*, *Sends from: Eichenberg & Associates &lt;noreply@…&gt;*, *Replies go to: support@…*, *New leads go to: jennifer@…*.
2. **Send test** (the button in that panel). You'll get *"Sent."* or the exact SendGrid error; see the table below. You can also run it from the Replit Shell:
   ```
   npm run mail:test -- you@example.com
   ```
3. **Did it land in the inbox?** Send one test to Jennifer's address and one to a personal Gmail. In Gmail, open it → ⋮ → **Show original**. You want **SPF: PASS, DKIM: PASS, DMARC: PASS**. If DKIM shows `sendgrid.net` or DMARC fails, domain authentication (step 1) isn't finished yet.
4. **End-to-end, Contact form.** On the live site, submit the Contact form with a personal address.
   - Jennifer receives "Website inquiry — …", and clicking Reply addresses the visitor.
   - The personal address receives "Thanks — …" from `noreply@`, and clicking Reply addresses `support@`. Send that reply and confirm it arrives in `support@`.
   - The submission also appears in Dashboard → Lead inbox.
5. **End-to-end, a landing page.** Complete one persona form (e.g. `/for/operations`). Jennifer gets "New lead — …", and the visitor gets the thank-you with the guide link. Click the guide link to make sure it opens.
6. **Password reset.** `/login` → *Forgot your password?* with a dashboard login. The link should arrive within a minute and work once.
7. **SendGrid side.** SendGrid → **Activity**. Each message shows as *Processed → Delivered*, and you can filter by the categories above.
8. Repeat step 2 on the **deployed** site's dashboard. It uses its own Secrets.

### If something goes wrong

| What you see | Cause | Fix |
|---|---|---|
| `SendGrid 401: The provided authorization grant is invalid, expired, or revoked` | Wrong, partial or revoked key | Re-paste `SENDGRID_API_KEY` (whole `SG.…` string, no spaces), restart/redeploy. |
| `SendGrid 403: The from address does not match a verified Sender Identity` | `CONTACT_FROM_EMAIL` isn't verified | Use exactly `noreply@eichenbergassociates.com`, or finish domain authentication. |
| `SendGrid 403: access forbidden` | Key lacks Mail Send permission | Edit the key's permissions, or create a new restricted key. |
| `Email is not set up yet` / *Provider: Not set up* | Secret missing in **this** environment | Add it in the workspace *or* deployment Secrets (whichever you're testing), restart/redeploy. |
| "Sent", but nothing arrives | Dropped or bounced | SendGrid → Activity, search the address. If it's *Dropped*, remove the address from **Suppressions** (Bounces/Blocks/Spam reports). |
| Arrives in spam | Domain not authenticated, or a new domain reputation | Finish step 1 (domain auth + DMARC); mark "Not spam" and add `noreply@` to contacts. |
| Nothing is delivered, but everything says "Sent" | `SENDGRID_SANDBOX=true` is set | Remove it. |

---

## 4. For Jennifer: keeping email healthy over time

Think of the website's email like a company car: it runs itself day to day, but it needs a quick look now and then, and a few rules keep it out of trouble.

**Every day (or set up a forward)**
- **`support@` is where your visitors' replies land.** When someone answers their thank-you email ("our go-live is in 60 days!"), that's where it goes. Check it daily, or have it forward to your main inbox.
- **Add `noreply@eichenbergassociates.com` to your contacts**, so your own lead notifications never slip into junk. If one ever does, mark it "Not spam".

**Every week, about two minutes**
- Glance at **SendGrid → Activity**. You're looking for anything that isn't *Delivered*: bounces (a mistyped address) or spam reports.
- If a lead says "I never got the guide", search their address in Activity. If it says *Dropped*, their address is on the suppression list; remove it there and resend.

**Every month**
- Skim the DMARC report emails that arrive at `support@`. Once a few weeks pass with everything passing, we'll tighten the DMARC policy to `quarantine`.
- Check the SendGrid plan and billing are current, because a lapsed plan quietly stops all site email, including your lead notifications.

**Rules of the road**
- **Never share the API key** by email, chat or a document. It's a password to send mail as your company. If it ever leaks, delete it in SendGrid and create a new one; the site only needs the new value pasted into Replit Secrets.
- **Rotate the key once a year**, and whenever someone with access leaves.
- **Keep two-factor authentication on** the SendGrid login, and add people as Teammates instead of sharing your password.
- **Changing the "from" address?** Verify the new address in SendGrid *first*, then update `CONTACT_FROM_EMAIL` in Replit, then press **Send test** in Dashboard → Settings.
- **This setup is for one-to-one, expected email** (form confirmations, notifications, resets). For a newsletter or announcement to many people, use a newsletter tool with an unsubscribe link and your mailing address in the footer. That's the law (CAN-SPAM), and it keeps marketing complaints from damaging delivery of your lead notifications.
- **After any change to email settings, press Send test.** It takes five seconds and tells you immediately whether everything still works.
