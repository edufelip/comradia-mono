import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTIFICATION_LOCALES,
  notificationCopy,
  notificationLocale,
} from "../src/notification-locale";

test("provides private match and message alerts for every supported locale", () => {
  assert.deepEqual(NOTIFICATION_LOCALES, [
    "en-US",
    "pt-BR",
    "es-ES",
    "fr-FR",
    "de-DE",
    "it-IT",
  ]);
  for (const locale of ["fr-FR", "de-DE", "it-IT"] as const) {
    for (const type of ["match", "message"] as const) {
      const copy = notificationCopy(locale, type);
      assert.ok(copy.title.length > 0 && copy.body.length > 0);
      assert.doesNotMatch(
        `${copy.title} ${copy.body}`,
        /Alice|Bob|message content/i,
      );
    }
  }
});

test("keeps unknown and malformed locale values on the English fallback", () => {
  for (const value of ["zz-ZZ", "fr-fr", "", null, 42, ["it-IT"]]) {
    assert.equal(notificationLocale(value), "en-US");
  }
});

test("uses the same connection terminology as the French and Italian app", () => {
  assert.deepEqual(notificationCopy("fr-FR", "match"), {
    title: "Nouvelle connexion",
    body: "Vous avez une nouvelle connexion.",
  });
  assert.deepEqual(notificationCopy("it-IT", "match"), {
    title: "Nuova affinità",
    body: "Hai una nuova affinità.",
  });
});
