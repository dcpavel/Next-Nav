"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidDirectoryPath = void 0;
const fs = require("fs/promises");
const path = require("path");
const vscode = require("vscode");
const logger_1 = require("./utils/logger");
isSubdirectory;
/**
 * Checks that child directory is within parent directory
 *
 * @param parent The parent directory
 * @param child The child directory
 * @returns True if child is a subdirectory of parent, false otherwise
 */
function isSubdirectory(parent, child) {
    logger_1.logger.info('Checking if ' + child + ' is a subdirectory of ' + parent);
    const parentPath = path.resolve(parent).toLowerCase();
    const childPath = path.resolve(child).toLowerCase();
    logger_1.logger.info('Parent path: ' + parentPath);
    logger_1.logger.info('Child path: ' + childPath);
    const isChild = parentPath.startsWith(childPath);
    logger_1.logger.info('Is subdirectory: ' + isChild);
    return isChild;
}
/**
 * Get a valid directory path within the workspace
 *
 * @param  dirPath Path to the directory
 * @returns The validated directory path, or an empty string if the path is invalid
 */
async function getValidDirectoryPath(dirPath) {
    logger_1.logger.info('Validating directory path: ' + dirPath);
    try {
        if (!vscode.workspace.workspaceFolders) {
            logger_1.logger.warn('No workspace folders found');
            return '';
        }
        const workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
        logger_1.logger.info('Workspace directory: ' + workspaceDir);
        // Convert to absolute path if it is a relative path
        const absoluteDirPath = path.isAbsolute(dirPath)
            ? dirPath
            : path.join(workspaceDir, dirPath);
        logger_1.logger.info('Absolute directory path: ' + absoluteDirPath);
        // Validate if this path is within the workspace directory
        if (!isSubdirectory(absoluteDirPath, workspaceDir)) {
            logger_1.logger.warn('Directory path is not within the workspace directory', workspaceDir, absoluteDirPath);
            return '';
        }
        // Check if the directory actually exists
        const stat = await fs.stat(absoluteDirPath);
        if (!stat.isDirectory()) {
            logger_1.logger.warn('Directory does not exist', absoluteDirPath);
            return '';
        }
        //logging path to test in windows
        logger_1.logger.info('Path is a directory in the workspace, returning', absoluteDirPath);
        return absoluteDirPath; // Return the validated absolute directory path
    }
    catch (err) {
        logger_1.logger.error('Error validating directory path', err);
        return '';
    }
}
exports.getValidDirectoryPath = getValidDirectoryPath;
//# sourceMappingURL=functions.js.map