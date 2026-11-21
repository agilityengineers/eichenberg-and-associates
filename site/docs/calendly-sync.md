# Calendly sync

Booked calls flow from Calendly into the dashboard, so the pipeline knows when a call is booked, moved or canceled.

## What it does

| In Calendly | In the dashboard |
|---|---|
| Someone books a call | The deal's next step becomes the call name and its due date the call date. The call shows on the Overview "Today" list and on the deal page (time, join link, reschedule link). |
| They reschedule | The old time is marked canceled, the new one takes over, and the due date moves. |
| They cancel | The deal's next step becomes "Call canceled: rebook", due today. |

**Whose call is it?** In this order:
1. The lead id. The calendar on the contact page and the landing pages passes it through Calendly's tracking field (`utm_content`), and Calendly sends it back with the booking. Exact match, even if they book with a different email.
2. The email address, matched against form submissions and earlier bookings.
3. No match (someone used a bare Calendly link from LinkedIn outreach or an email signature): a new deal is opened in the first stage with source "Calendly".

## One-time setup (Jennifer's account)

1. In Calendly: **Integrations → API & webhooks → Personal access tokens → create a token**. Copy it.
2. In Replit **Secrets**, add:
   - `CALENDLY_TOKEN`: the token from step 1.
   - `CALENDLY_WEBHOOK_SIGNING_KEY`: any long random phrase (for example from a password generator). Calendly signs each notification with it and the site checks the signature.
3. Redeploy, then open **Dashboard → Settings → Calendly** and press **Connect**. It reads the account, registers the notification address, and pulls in upcoming calls.

Requirements: a paid Calendly plan (webhooks are not on the free plan), and `PUBLIC_SITE_URL` set to the live address, because that is where Calendly is told to send notifications.

## How it works

- `src/lib/calendly.ts`: signature check, a small API client, and `applyBooking()` (matching and deal updates).
- `POST /api/calendly/webhook`: public, but every request must carry a valid `Calendly-Webhook-Signature`
  (HMAC-SHA256 of `timestamp.body`, three-minute window). Repeat deliveries are harmless: a booking is keyed by
  its Calendly invitee address.
- `POST /api/admin/calendly`: Connect, Check for calls now, Disconnect, time zone. Signed-in admins only.
- `bookings` table in `db/schema.sql`; connection state is one row in `settings` (key `calendly`).
- "Check for calls now" re-reads upcoming calls from Calendly. Use it if a notification was missed (for example
  during a redeploy).

## Verified, and not yet verified

Tested locally with simulated signed notifications and a stand-in for Calendly's API: on-site booking with a lead
id, bare-link booking with a known and an unknown email, a repeated delivery, reschedule, cancel, a bad signature,
a stale timestamp, an unsigned request, connect (twice), sync and disconnect.

**Not yet tested against Calendly itself.** No token for Jennifer's account was available, and Calendly's developer
documentation could not be reached from the build environment, so the request and payload field names follow
Calendly's v2 API as known rather than as re-read. After connecting, do one real test booking, reschedule it and
cancel it, and confirm each shows on the deal. If something does not line up, the field mapping is in one place:
`applyBooking()` and `connect()` in `src/lib/calendly.ts`.

## Limits

- Only future activity syncs. Calls that already happened before connecting are not imported.
- One Calendly user. Team or round-robin accounts would need an organization-scope subscription.
- A booking from a bare link by someone with no form submission creates a deal named after the person; add the
  company on the deal page.
