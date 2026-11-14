# Moderation: reviewing reports

## How an alert arrives

When someone files a report, a Cloud Function (`notifyOnReportCreated`) sends a push to each owner uid listed in `REPORT_ALERT_UIDS`. The reporter is never alerted about their own report.

The push says **"New report"** and **"Reason: <reason>"**. It never contains a name, the free-text details, a photo, or a uid, because lock screens are visible to others. Tapping it does nothing yet: open the Firebase console to review.

There is no in-app moderation tool. Review happens in the Firebase console.

## Set who gets alerts (per project)

1. Find your uid: Firebase console → project `comradia-dev` → Authentication → Users → click your account → copy **User UID**.
2. In `apps/firebase/functions/`, create the file `.env.comradia-dev` (git ignores it) with one line:
   `REPORT_ALERT_UIDS=<your uid>`
   For several owners, separate uids with commas. Empty means no alerts.
3. Redeploy the functions from `apps/firebase`:
   `firebase deploy --project dev --only functions`
4. For production, do the same with a `.env.<prod project id>` file. `.firebaserc` has no prod alias yet, so add one before deploying there.

## Review a report

1. Firebase console → Firestore Database → collection `reports`. Newest reports are the ones to read first.
2. Read these fields:
   - `reason`: harassment, hate, fake, spam, underage, or other
   - `details`: free text from the reporter, up to 500 characters
   - `context`: `profile` (a card) or `chat`
   - `target`: the uid of the reported person
   - `reporter`: the uid of the person who filed it
   - `createdAt`: when it was filed
3. Open `profiles/{target}` for the card (name, values, prompt answer, `photoPath`).
4. To see the photo, open Storage → `photos/{target}/`. The file in `photoPath` is the current one.
5. To see the account status, open Authentication → Users and search for the `target` uid.

## Actions

- **Remove a bad photo:** Storage → `photos/{target}/` → delete the file. Then Firestore → `profiles/{target}` → set `photoPath` to `null`.
- **Disable the account:** Authentication → Users → click the account → **Disable account**.
- **Delete the profile:** Firestore → `profiles` → `{target}` → **Delete document**. This removes the card only.

## Underage reports

Act first, review later. Disable the account, delete the profile document, and delete the photo file in Storage. Do this at once, without waiting for more reports or the details.

## Limits

- Alerts are sent once per report to each owner. A failed push is not retried, so check `reports` in the console too.
- Nothing is removed automatically. Every action above is manual.
