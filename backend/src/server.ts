import 'dotenv/config';

import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const port = Number.parseInt(process.env.PORT ?? '5000', 10);

const app = createApp();

app.listen(port, () => {
  logger.info('Backend listening', { port });
});
