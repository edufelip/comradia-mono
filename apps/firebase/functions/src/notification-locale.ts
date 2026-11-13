export const NOTIFICATION_LOCALES = [
  "en-US",
  "pt-BR",
  "es-ES",
  "fr-FR",
  "de-DE",
  "it-IT",
] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

export function notificationLocale(value: unknown): NotificationLocale {
  return (NOTIFICATION_LOCALES as readonly unknown[]).includes(value)
    ? (value as NotificationLocale)
    : "en-US";
}

const COPY = {
  "en-US": {
    match: { title: "New match", body: "You have a new match." },
    message: { title: "New message", body: "You received a new message." },
  },
  "pt-BR": {
    match: { title: "Novo match", body: "Você tem um novo match." },
    message: {
      title: "Nova mensagem",
      body: "Você recebeu uma nova mensagem.",
    },
  },
  "es-ES": {
    match: { title: "Nuevo match", body: "Tienes un nuevo match." },
    message: { title: "Nuevo mensaje", body: "Has recibido un nuevo mensaje." },
  },
  "fr-FR": {
    match: {
      title: "Nouvelle connexion",
      body: "Vous avez une nouvelle connexion.",
    },
    message: {
      title: "Nouveau message",
      body: "Vous avez reçu un nouveau message.",
    },
  },
  "de-DE": {
    match: { title: "Neues Match", body: "Du hast ein neues Match." },
    message: {
      title: "Neue Nachricht",
      body: "Du hast eine neue Nachricht erhalten.",
    },
  },
  "it-IT": {
    match: { title: "Nuova affinità", body: "Hai una nuova affinità." },
    message: {
      title: "Nuovo messaggio",
      body: "Hai ricevuto un nuovo messaggio.",
    },
  },
};

export function notificationCopy(
  locale: NotificationLocale,
  type: "match" | "message",
) {
  return COPY[locale][type];
}
