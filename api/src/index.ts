import { config } from 'dotenv';
import { initializeDB } from './db/connect';
import { initializeServer } from './server';
import { initializeLogger } from './utils/logger';

const runAPI = async (): Promise<void> => {
  config();
  const logger = initializeLogger();
  try {
    await initializeDB();
    logger.info('database connection set up');
    await initializeServer();
    logger.info('server started');
  } catch(err) {
    logger.fatal(err.message);
  }
};

if (!module.parent) {
  runAPI();
}

export default runAPI;
