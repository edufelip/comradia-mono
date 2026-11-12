# Match and message notifications

## Contract

Native clients use Firebase Cloud Messaging. Web does not register for push. Permission is requested only when the person enables notifications in Profile; restoring an already granted registration must not display a new prompt.

Device registrations are private documents at `users/{uid}/pushTokens/{sha256(token)}` with exactly `token`, `platform` (`ios` or `android`), and server `updatedAt`. Registration and refresh belong to the current authenticated account. Sign-out revokes the local device's association before ending the Firebase session; deleting an account removes all its token documents explicitly because deleting the parent document does not delete subcollections.

Create-only Firestore triggers handle new matches and messages. A match targets its two members; a message targets the other member. Current account/profile existence, match membership and both block directions must be checked before dispatch. Invalid FCM registrations are pruned. Delivery state is server-only. The server considers the newest 20 registrations per account. A claim is written before the external FCM request to suppress duplicate events: a failure after claiming can lose an alert. See [Functions delivery behavior](../apps/firebase/functions/README.md) for this deliberate tradeoff and the final-check race window.

Lock-screen copy is generic: no name, message text, profile details or political values. Data contains `type` (`match` or `message`), `matchId`, and `recipientUid`. Android uses the `matches-messages` channel. The app accepts no arbitrary URL from notification data. Before opening a match or chat it waits for a ready session and verifies the intended recipient, current match and blocks. Switching accounts discards an alert for the previous recipient.

## Validation and release evidence

Keep these claims separate:

1. Unit/component tests establish routing, permission and lifecycle behavior.
2. Firestore emulator tests establish token ownership rules and server adapter behavior; a substituted FCM transport does not prove provider delivery.
3. A native build establishes plugin, entitlement and dependency compatibility.
4. Deploying the Functions and rules establishes the dev environment uses this code.
5. FCM acceptance establishes provider acceptance; an observed alert establishes device receipt.
6. Opening an observed alert from background and terminated states establishes tap routing on that platform.

Before a dev rollout, verify APNs credentials for the exact Firebase iOS app, push entitlements and signing, Android permission/channel behavior, and authenticated Firebase deployment access. Run the two-account match/message flow on the new native binary, with foreground, background, terminated, blocked and signed-out cases. Never use owner account deletion as a destructive smoke-test fixture.

Cloud deployment is separate from implementation. The existing project boundary requires owner approval before enabling new paid/hourly cloud work. Keep real SMS disabled. Build and emulator validation do not require opening SMS delivery.
