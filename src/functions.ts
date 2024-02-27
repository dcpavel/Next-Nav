import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './utils/logger';

/**
 * Checks that child directory is within parent directory
 *
 * @param parent The parent directory
 * @param child The child directory
 * @returns True if child is a subdirectory of parent, false otherwise
 */
function isSubdirectory(parent: string, child: string) {
  logger.info('Checking if ' + child + ' is a subdirectory of ' + parent);

  const parentPath = path.resolve(parent).toLowerCase();
  const childPath = path.resolve(child).toLowerCase();

  logger.info('Parent path: ' + parentPath);
  logger.info('Child path: ' + childPath);

  const isChild = parentPath.startsWith(childPath);
  logger.info('Is subdirectory: ' + isChild);
  return isChild;
}

/**
 * Get a valid directory path within the workspace
 *
 * @param  dirPath Path to the directory
 * @returns The validated directory path, or an empty string if the path is invalid
 */
export async function getValidDirectoryPath(dirPath: string): Promise<string> {
  logger.info('Validating directory path: ' + dirPath);

  try {
    if (!vscode.workspace.workspaceFolders) {
      logger.warn('No workspace folders found');
      return '';
    }

    const workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
    logger.info('Workspace directory: ' + workspaceDir);

    // Convert to absolute path if it is a relative path
    const absoluteDirPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workspaceDir, dirPath);
    logger.info('Absolute directory path: ' + absoluteDirPath);

    // Validate if this path is within the workspace directory
    if (!isSubdirectory(absoluteDirPath, workspaceDir)) {
      logger.warn(
        'Directory path is not within the workspace directory',
        workspaceDir,
        absoluteDirPath
      );
      return '';
    }
    // Check if the directory actually exists
    const stat = await fs.stat(absoluteDirPath);
    if (!stat.isDirectory()) {
      logger.warn('Directory does not exist', absoluteDirPath);
      return '';
    }
    //logging path to test in windows

    logger.info(
      'Path is a directory in the workspace, returning',
      absoluteDirPath
    );
    return absoluteDirPath; // Return the validated absolute directory path
  } catch (err: any) {
    logger.error('Error validating directory path', err);
    return '';
  }
}
