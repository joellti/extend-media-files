import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import minimatch = require('minimatch');

async function getDestPath(
  wsPath: string,
  docPath: string,
  filePath: string,
): Promise<string | null> {

  // Compute path of Markdown file relative to workspace
  let markdownRelative = path.relative(wsPath, docPath).replace(/\\/g, '/');

  // Read user markdown.copyFiles.destination
  const config = vscode.workspace.getConfiguration('markdown');
  const destinations = config.get<Record<string, string>>('copyFiles.destination') ?? {};
  
  // Read user markdown.copyFiles.overwriteBehavior
  const overwriteBehavior = config.get<'overwrite' | 'nameIncrementally'>('copyFiles.overwriteBehavior') ?? 'nameIncrementally';

  // Find first glob that matches the Markdown file
  let destTemplate: string | undefined;
  for (const [pattern, folder] of Object.entries(destinations)) {
    if (minimatch.minimatch(markdownRelative, pattern)) {
      destTemplate = folder;
      break;
    }
  }

  // Same folder as markdown file by default
  if (!destTemplate) {
    destTemplate = '';
  }

  // Expand ${documentBaseName}
  const docBase = path.basename(docPath, path.extname(docPath));
  destTemplate = destTemplate.replace(/\$\{documentBaseName\}/g, docBase);

  // Destination folder relative to Markdown file
  const destDir = path.join(path.dirname(docPath), destTemplate);

  //let destPath = path.join(destDir, fileItem.name);
  let destFileName = path.basename(filePath);
  let destPath = path.join(destDir, destFileName);
  
  // Handle rename if needed
  if (fs.existsSync(destPath) && overwriteBehavior === 'nameIncrementally') {
    const MAX_RENAME_ATTEMPTS = 100;
    let counter = 1;
    const ext = path.extname(destFileName);
    const base = path.basename(destFileName, ext);
    destPath = path.join(destDir, `${base}-${counter}${ext}`);
    while (fs.existsSync(destPath) && counter <= MAX_RENAME_ATTEMPTS) {
        counter++;
        destPath = path.join(destDir, `${base}-${counter}${ext}`);
    }

    if (fs.existsSync(destPath)) {
        vscode.window.showErrorMessage('Cannot create unique file name, too many duplicates.');
        return null;
    }
  }

  return destPath;

}

async function process(
  document: vscode.TextDocument,
  dataTransfer: vscode.DataTransfer,
) : Promise<{ additionalEdit: vscode.WorkspaceEdit; insertText: string; } | null> {

  const extString: string = vscode.workspace
  .getConfiguration('extendMediaFiles')
  .get('extensions') ?? 'pdf';

  // Split by comma, trim spaces, convert to lowercase
  const allowedExtensions = extString.split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log('No workspace folder found');
    vscode.window.showErrorMessage('File drop failed: no workspace folder detected.');
    return null;
  }
  const wsPath = workspaceFolder.uri.fsPath;
  const docPath = document.uri.fsPath;
  const additionalEdit = new vscode.WorkspaceEdit();
  let insertText = "";
  
  // Go through files dropped to document
  for (const [mime, item] of dataTransfer) {

    const file = item.asFile();
    let filePath;
    if (file?.uri?.fsPath) {

      let fileUri = file?.uri;
      filePath = file?.uri?.fsPath;

      // Skip files with ext not in list
      let ext;
      ext = path.extname(filePath).slice(1).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        console.log(`ext: ${ext}`);
        vscode.window.showInformationMessage('File extension not supported');
        continue;
      }

      // Figure out where to copy file to
      let destPath = await getDestPath(wsPath, docPath, filePath) ?? '';

      // Copy the file and allow undo
      const destUri = vscode.Uri.file(destPath);
      additionalEdit.createFile(destUri, {
        contents: file,
        ignoreIfExists: true
      });

      // Text to be added to the document
      const relPath = path.relative(path.dirname(docPath), destPath).replace(/\\/g, '/');
      let destFileName = path.basename(filePath);
      const linkText = `[[${relPath}|${destFileName}]]`;
      insertText +=  `${linkText}\n`;

    }

  }

  return { additionalEdit, insertText };

}

export function activate(context: vscode.ExtensionContext) {

  vscode.window.showInformationMessage('Extend Media Files extension activated');

  // --- Drag-drop provider ---
  let dropProvider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(document, position, dataTransfer, token) {
      let result;
      if (result = await process(document, dataTransfer)) {
        const dropEdit = new vscode.DocumentDropEdit(new vscode.SnippetString(result.insertText));
        dropEdit.additionalEdit = result.additionalEdit;
        return dropEdit;
      } else {
        return null;
      }
    }
  };
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider({ language: 'markdown' }, dropProvider)
  );

  // --- Copy-paste provider ---
  const pasteProvider: vscode.DocumentPasteEditProvider = {
    async provideDocumentPasteEdits(document, ranges, dataTransfer, context, token) {
      let result;
      if (result = await process(document, dataTransfer)) {
        const pasteEdit = new vscode.DocumentPasteEdit(
          result.insertText,
          'Insert Link',
          vscode.DocumentDropOrPasteEditKind.Text
        );
        pasteEdit.additionalEdit = result.additionalEdit;
        return [ pasteEdit ];
      }
    }
  };
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: 'markdown' },
      pasteProvider,
      {
        pasteMimeTypes: ['application/pdf'],
        providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Text]
      }
    )
  );

}
