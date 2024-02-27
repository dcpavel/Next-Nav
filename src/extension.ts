import * as vscode from 'vscode';
import * as path from 'path';
import treeMaker from './makeTree';
import { promises as fs } from 'fs';
import { getValidDirectoryPath } from './functions';
import { logger } from './utils/logger';

let lastSubmittedDir: string | null = null; // directory user gave
let webview: vscode.WebviewPanel | null = null;

/**
 * Activate the extension.
 * This looks like it could be refactored a bit.
 *
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('Activating the extension');

  const iconName = 'next-nav-icon';
  context.globalState.update(iconName, true);

  logger.info('Creating the status bar item');
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  statusBarItem.text = 'Next.Nav';
  statusBarItem.command = 'next-extension.next-nav';
  statusBarItem.tooltip = 'Launch Next Nav';
  statusBarItem.show();

  logger.info(statusBarItem, 'Adding the status bar item to the subscriptions');
  context.subscriptions.push(statusBarItem);

  //runs when extension is called every time
  let disposable = vscode.commands.registerCommand(
    'next-extension.next-nav',
    async () => {
      await commandHandler(context);
    }
  );
  context.subscriptions.push(disposable);
}
export function deactivate() {}

/**
 * Send the updated directory to the webview.
 *
 * @param webview The webview to send the updated directory to.
 * @param dirName The directory name to send to the webview.
 */
async function sendUpdatedDirectory(
  webview: vscode.WebviewPanel,
  dirName: string
): Promise<void> {
  logger.info('About to send the updated directory:', dirName);
  const childLogger = logger.child({ dirName });

  try {
    childLogger.trace('About to make the tree');

    // Call treeMaker with only one folder name
    const result = await treeMaker(dirName);
    childLogger.trace(result, 'Tree made successfully');

    const sendString = JSON.stringify(result);

    childLogger.trace('Sending the tree to the webview');
    webview.webview.postMessage({ command: 'sendString', data: sendString });
  } catch (error: any) {
    vscode.window.showErrorMessage(
      'Error sending updated directory: ' + error.message
    );
    logger.error(error, 'Error sending updated directory');
  } finally {
    logger.info('Finished sending the updated directory');
  }
}

/**
 * Handle the command from the extension.
 *
 * @param context The extension context.
 */
async function commandHandler(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Displaying the Next.Nav webview');

  //search for an existing panel and redirect to that if it exists
  if (webview) {
    logger.info('Revealing the existing webview');
    webview.reveal(vscode.ViewColumn.One);
    return;
  }

  logger.info('Creating a new webview');
  //create a webview to put React on
  webview = vscode.window.createWebviewPanel(
    'Next.Nav',
    'Next.Nav',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      //make the extension persist on tab
      retainContextWhenHidden: true,
    }
  );

  // This returns a function which we don't capture, is this by intention?
  // The description says it returns a disposable, which unsubscribes the event listener,
  // Do we need to unbsubscribe the event listener?
  logger.info('Creating an event listener for when the webview is disposed');
  webview.onDidDispose(
    () => {
      webview = null;
    },
    null,
    context.subscriptions
  );

  // don't we want to throw this error before trying to call the onDidDispose function?
  if (webview === null) {
    logger.error('Webview is null');
    throw new Error('Webview is null');
  }

  const cloneView = webview as vscode.WebviewPanel;
  logger.info('Created a clone view', cloneView);

  // When we get requests from React
  cloneView.webview.onDidReceiveMessage(
    // TODO: another function that can be pulled out and refactored
    async (message) => {
      await messageHandler(message, cloneView);
    },
    undefined,
    context.subscriptions
  );

  try {
    logger.info('Reading the bundle');
    //bundle for react code
    const bundlePath = path.join(
      context.extensionPath,
      'webview-react-app',
      'dist',
      'bundle.js'
    );

    logger.info('Opening the file at', bundlePath);
    const bundleContent = await fs.readFile(bundlePath, 'utf-8');
    logger.info('file opened successfully');
    //html in the webview to put our react code into
    webview.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Next.Nav</title>
          <link rel="icon" type="image/x-icon" href="">
        </head>
        <body>
          <div id="root"></div>
          <script>
          ${bundleContent}
          </script>
        </body>
        </html>`;
    logger.info('Changed the webview html to include the React bundle.');
  } catch (err) {
    logger.error(err, 'Error reading the bundle.');
  }
  // vscode.window.showInformationMessage('Welcome to Next.Nav!');
}

/**
 * Handle the event from the webview
 *
 * @param message The event from the webview
 * @param cloneView The webview to send the response to
 */
async function messageHandler(
  message: any,
  cloneView: vscode.WebviewPanel
): Promise<void> {
  const childLogger = logger.child({ message });
  let response: object = {};

  try {
    switch (message.command) {
      case 'submitDir':
        childLogger.info('Received a submitDir message');
        let formCheck = message['form'] ? true : false;
        if (formCheck) {
          childLogger.trace('Form key exists in the message');
        }
        await submitDir(message.folderName, formCheck);
        break;

      case 'getRequest':
        childLogger.trace('Received a getRequest message');
        if (lastSubmittedDir) {
          // why did we use webview instead of cloneview here?
          // await sendUpdatedDirectory(webview, lastSubmittedDir);
          await sendUpdatedDirectory(cloneView, lastSubmittedDir);
        } else {
          throw Error('No directory has been submitted yet.');
        }
        break;

      case 'open_file':
        childLogger.trace('Received an open_file message');
        response = await openFile(message.filePath);
        break;

      case 'addFile':
        childLogger.trace('Received an addFile message');
        response = await addFile(message.filePath);
        break;

      case 'addFolder':
        childLogger.trace('Received an addFolder message');
        response = await addFolder(message.filePath);
        break;

      case 'deleteFile':
        childLogger.trace('Received a deleteFile message');
        response = await deleteFile(message.filePath);
        break;

      case 'deleteFolder':
        childLogger.trace('Received a deleteFolder message');
        response = await deleteFolder(message.filePath);
        break;

      default:
        childLogger.error('Received an unknown message:', message);
        throw new Error('Unknown command');
    }

    childLogger.trace('Sending the response to the webview');
    cloneView.webview.postMessage(response);
    // No default case, we should handle all cases, even with an error
  } catch (error: any) {
    childLogger.error(`Error in ${message.command}:`, error.message);
    vscode.window.showErrorMessage('Error handling message: ' + error.message);
  }
}

/**
 * Submit a directory to the extension.
 * Set the lastSubmittedDir to the folderLocation if the directory path is valid.
 *
 * @param folderName The folder name to submit to the extension
 * @param formCheck Whether the form key exists in the message
 * @returns The response to send to the webview
 */
async function submitDir(
  folderName: string,
  formCheck: boolean
): Promise<object> {
  const folderLocation = await getValidDirectoryPath(
    path.normalize(folderName)
  );

  if (folderLocation) {
    // if the directory path is valid, set the lastSubmittedDir to the folderLocation
    lastSubmittedDir = folderLocation;
  }

  return {
    command: 'submitDirResponse',
    result: folderLocation ? true : false,
    form: formCheck,
  };
}

/**
 * Open a file at the specified path.
 *
 * @param filePath The path to the file to open
 * @returns The response to send to the webview
 */
async function openFile(filePath: string): Promise<object> {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
  return { command: 'opened_file' };
}

/**
 * Add a file at the specified path.
 *
 * @param filePath The path to the file to add
 * @returns The response to send to the webview
 */
async function addFile(filePath: string): Promise<object> {
  await fs.writeFile(path.normalize(filePath), '');
  return { command: 'added_addFile' };
}

/**
 * Add a folder at the specified path.
 *
 * @param folderPath The path to the folder to add
 * @returns The response to send to the webview
 */
async function addFolder(folderPath: string): Promise<object> {
  await fs.mkdir(path.normalize(folderPath));
  return { command: 'added_addFolder' };
}

/**
 * Delete a file at the specified path.
 *
 * @param filePath The path to the file to delete
 * @returns The response to send to the webview
 */
async function deleteFile(filePath: string): Promise<object> {
  const uri = vscode.Uri.file(path.normalize(filePath));
  if (await fs.stat(filePath)) {
    await vscode.workspace.fs.delete(uri, { useTrash: true });
  } else {
    throw new Error('File does not exist');
  }
  //let the React know we deleted a file
  return {
    command: 'added_deleteFile',
  };
}

/**
 * Delete a folder at the specified path.
 *
 * @param folderPath The path to the folder to delete
 * @returns The response to send to the webview
 */
async function deleteFolder(folderPath: string): Promise<object> {
  const uri = vscode.Uri.file(path.normalize(folderPath));

  //delete folder and subfolders
  if (await fs.stat(folderPath)) {
    await vscode.workspace.fs.delete(uri, {
      recursive: true,
      useTrash: true,
    });
  } else {
    throw new Error('Folder does not exist');
  }

  return { command: 'added_deleteFolder' };
}
