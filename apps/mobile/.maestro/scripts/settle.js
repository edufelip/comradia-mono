/**
 * Waits 3 s without touching the screen. Maestro has no sleep command, and right after a
 * launch any screen read can hit an iOS snapshot error that Maestro treats as fatal.
 */
const until = Date.now() + 3000;
while (Date.now() < until) {
  // busy-wait: the Maestro JS runtime has no timers
}
