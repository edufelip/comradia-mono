// Metro chooses `.native.ts` or `.web.ts`; this base export keeps TypeScript's resolver and
// other unsupported platforms on the explicit no-op implementation.
export * from './notifications.web';
