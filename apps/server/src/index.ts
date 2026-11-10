import { createApp } from './app';
import { readConfig } from './config';

const config = readConfig();

createApp(config).listen(config.port);

console.log(`Comradia server listening on http://localhost:${config.port}`);
