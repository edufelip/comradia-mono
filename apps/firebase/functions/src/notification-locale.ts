export const NOTIFICATION_LOCALES = ['en-US', 'pt-BR', 'es-ES'] as const;
export type NotificationLocale = typeof NOTIFICATION_LOCALES[number];

export function notificationLocale(value: unknown): NotificationLocale {
  return value === 'pt-BR' || value === 'es-ES' ? value : 'en-US';
}

const COPY = {
  'en-US': {
    match: { title: 'New match', body: 'You have a new match.' },
    message: { title: 'New message', body: 'You received a new message.' },
  },
  'pt-BR': {
    match: { title: 'Novo match', body: 'Você tem um novo match.' },
    message: { title: 'Nova mensagem', body: 'Você recebeu uma nova mensagem.' },
  },
  'es-ES': {
    match: { title: 'Nuevo match', body: 'Tienes un nuevo match.' },
    message: { title: 'Nuevo mensaje', body: 'Has recibido un nuevo mensaje.' },
  },
};

export function notificationCopy(locale: NotificationLocale, type: 'match' | 'message') {
  return COPY[locale][type];
}
