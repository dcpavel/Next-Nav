import { readdir } from 'fs/promises';
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { basename, join } from 'path';
import { Directory } from './types';
import { logger } from './utils/logger';

/**
 * Checks if a file contains the 'use client' directive
 *
 * @param filePath Path to the file
 * @returns Whether the file contains the 'use client' directive
 */
export async function checkForClientDirective(
  filePath: string
): Promise<boolean> {
  logger.info('Checking for client directive in file: ' + filePath);

  // Create a Readable Stream to read the file
  const rl = createInterface({
    input: createReadStream(filePath, { end: 9999 }), // Read up to the first 10,000 bytes assuming the client is in there dont want to read whole file
  });

  let firstNonCommentText = ''; // Store the first non-comment line of code
  let inCommentBlock = false; // Flag for inside a block comment

  logger.info('Reading file line by line');
  for await (const line of rl) {
    const childLogger = logger.child({ line: line });
    childLogger.info('Reading line');

    // Check if inside a block comment
    if (inCommentBlock) {
      if (line.includes('*/')) {
        childLogger.trace(
          'End if block comment found, exiting block comment mode'
        );
        inCommentBlock = false;
      }
      continue;
    }

    childLogger.trace('Checking for start of block comments');
    let startCommentIndex = line.indexOf('/*');
    if (startCommentIndex !== -1) {
      inCommentBlock = true;
      childLogger.trace('Entering block comment mode');

      // Check if it is a single-line block comment
      let endCommentIndex = line.indexOf('*/');
      if (endCommentIndex !== -1 && endCommentIndex > startCommentIndex) {
        childLogger.trace('Exiting block comment mode');
        inCommentBlock = false;

        childLogger.trace('Removing block comment');
        // Remove the block comment and check the remaining text if there is a comment and code on the same line
        const modifiedLine =
          line.slice(0, startCommentIndex) + line.slice(endCommentIndex + 2);
        if (modifiedLine.trim()) {
          firstNonCommentText = modifiedLine.trim();
          childLogger.trace(
            'This is the first non-comment text',
            firstNonCommentText
          );
          childLogger.trace('Exiting loop');
          break;
        }

        childLogger.trace('No code on this line, continuing to next line');
        continue;
      }

      childLogger.trace(
        'This line is a block comment, continuing to next line'
      );
      continue;
    }

    // Remove single-line comments (//) and check the remaining text in a case where we have code then //comment
    const noSingleLineComment = line.split('//')[0].trim();
    if (noSingleLineComment) {
      childLogger.trace(
        'This is the first non-comment text',
        noSingleLineComment
      );
      firstNonCommentText = noSingleLineComment;
      childLogger.trace('Exiting loop');
      break;
    }
  }
  logger.info('Completed reading file');

  logger.info('Closing file stream');
  rl.close();

  const targetStrings = ['"use client"', "'use client'", '`use client`'];

  logger.info('Checking for client directive in first non-comment text');
  return targetStrings.some((target) => firstNonCommentText.includes(target));
}

/**
 * Makes a tree structure of a valid directory.
 * TODO: Why does this return a Directory array or an empty object?
 *
 * @param validDir The valid directory path
 * @returns Directory structure of the valid directory, or an empty object if an error occurred
 */
export default async function treeMaker(
  validDir: string
): Promise<Directory[] | {}> {
  logger.info('Making tree structure of directory: ' + validDir);

  let idCounter = 1;
  const extensions = /\.(js|jsx|css|ts|tsx|sass|scss|html)$/;
  //directory to be put into the output structure, id of the directory will match its index in the structure
  const structure: Directory[] = [
    {
      id: 0,
      folderName: basename(validDir),
      parentNode: null,
      path: validDir,
      contents: [],
      render: 'server',
    },
  ];

  // Recursive function to list files and populate structure
  async function listFiles(dir: string, parent: number): Promise<void> {
    const childLogger = logger.child({ dir: dir });

    childLogger.info('Listing files in directory');
    const entities = await readdir(dir, { withFileTypes: true });

    for (const entity of entities) {
      const entityLogger = childLogger.child({ entity: entity.name });
      entityLogger.info('Checking entity');

      const fullPath = join(dir, entity.name);

      if (entity.isDirectory()) {
        entityLogger.info('Found directory');
        const directoryData: Directory = {
          id: idCounter++,
          folderName: entity.name,
          parentNode: parent,
          path: fullPath,
          contents: [],
          render: 'server',
        };

        entityLogger.info('Adding directory to structure');
        structure.push(directoryData);

        entityLogger.info('Recursing into directory');
        await listFiles(fullPath, directoryData.id);
      } else if (extensions.test(entity.name)) {
        entityLogger.info('Found file');
        entityLogger.info('Adding file to parent in structure');
        structure[parent].contents.push(entity.name);

        entityLogger.info('Checking if this file has the client directive');
        if (await checkForClientDirective(fullPath)) {
          entityLogger.info('File contains client directive');
          structure[parent].render = 'client';
        }
      }
    }
  }

  try {
    await listFiles(validDir, 0);

    logger.info('Completed making tree structure: ', structure);

    return structure;
  } catch (err) {
    logger.error(err, 'Error making tree structure');

    return {};
  }
}
