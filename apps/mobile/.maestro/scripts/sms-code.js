/**
 * The last SMS code the Firebase auth emulator "sent" to `PHONE_NUMBER`.
 *
 * Maestro exposes `http` and `output` to this runtime; the `env` map of `runScript` arrives
 * as plain globals, so the flow's E.164 number is `PHONE_NUMBER`. The emulator has already recorded the code by the
 * time S1C is on screen, because the app only navigates after `startPhoneSignIn` resolves.
 */
const phone = PHONE_NUMBER;
const response = http.get(
  'http://localhost:9099/emulator/v1/projects/demo-comradia/verificationCodes',
);
const codes = JSON.parse(response.body).verificationCodes || [];
const sent = codes.filter((entry) => entry.phoneNumber === phone).pop();

output.code = sent ? sent.code : '';
