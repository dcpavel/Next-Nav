/**
 *  File for configuring the pino logger.
 *
 *  This will begin barebones, but I am including it so that it can be expanded upon as needed.
 */

import * as pino from 'pino';

export const logger = pino.pino({
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
});
