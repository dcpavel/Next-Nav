"use strict";
/**
 * File for configuring the pino logger.
 *
 * This will begin barebones, but I am including it so that it can be expanded upon as needed.
 *
 * Here is a link to the pino documentation: https://getpino.io/#/
 *
 * Here is a link to a tutorial on how to use pino:
 * https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino = require("pino");
const fileTransport = pino.pino.transport({
    targets: [
        {
            target: 'pino-pretty',
            options: {
                colorize: true,
            },
        },
        {
            target: 'pino/file',
            options: {
                destination: '../../logs/src.log',
            },
        },
    ],
});
/**
 * The pino logger.
 */
exports.logger = pino.pino({
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
}, fileTransport);
//# sourceMappingURL=logger.js.map