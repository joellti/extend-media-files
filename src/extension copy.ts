import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import minimatch = require('minimatch');

/**
 * Shared helper: copies PDF to workspace, applies markdown.copyFiles settings,
 * and generates Markdown link. Returns link text and WorkspaceEdit.
 */
async function copyFileAndGenerateLink(
  document: vscode.TextDocument,
  fileItem: vscode.DataTransferFile
): Promise<{ linkText: string; wsEdit: vscode.WorkspaceEdit } | null> {

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log('No workspace folder found');
    vscode.window.showErrorMessage('File drop failed: no workspace folder detected.');
    return null;
  }

    // Compute path of Markdown file relative to workspace
  let markdownRelative = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath).replace(/\\/g, '/');
  //console.log('Markdown relative path:', markdownRelative);

  // Read user markdown.copyFiles.destination
  const config = vscode.workspace.getConfiguration('markdown');
  const destinations = config.get<Record<string, string>>('copyFiles.destination') ?? {};
  //console.log('markdown.copyFiles.destination:', destinations);
  vscode.window.showInformationMessage('destinations: ');
  for (const [pattern, folder] of Object.entries(destinations)) {
    //vscode.window.showInformationMessage('pattern: ' + pattern);
  }
  
  // Read user markdown.copyFiles.overwriteBehavior
  const overwriteBehavior = config.get<'overwrite' | 'nameIncrementally'>('copyFiles.overwriteBehavior') ?? 'nameIncrementally';
  //console.log('markdown.copyFiles.overwriteBehavior:', overwriteBehavior);

  // Find first glob that matches the Markdown file
  let destTemplate: string | undefined;
  for (const [pattern, folder] of Object.entries(destinations)) {
    if (minimatch.minimatch(markdownRelative, pattern)) {
      destTemplate = folder;
      //console.log(`Pattern matched: ${pattern} → ${folder}`);
      break;
    }
  }

  if (!destTemplate) {
    destTemplate = 'assets/';
    console.log('No matching glob, using default folder:', destTemplate);
  }

  // Expand ${documentBaseName}
  const docBase = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
  //console.log('docBase:', docBase);
  destTemplate = destTemplate.replace(/\$\{documentBaseName\}/g, docBase);
  //console.log('destTemplate:', destTemplate);

  // Destination folder relative to Markdown file
  const destDir = path.join(path.dirname(document.uri.fsPath), destTemplate);

  // Ensure folder exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('Created folder:', destDir);
  }
  
  let destPath = path.join(destDir, fileItem.name);
  
  // Handle rename if needed
  if (fs.existsSync(destPath) && overwriteBehavior === 'nameIncrementally') {
    const MAX_RENAME_ATTEMPTS = 100;
    let counter = 1;
    const base = path.basename(fileItem.name, path.extname(fileItem.name));
    const ext = path.extname(fileItem.name);
    destPath = path.join(destDir, `${base}-${counter}${ext}`);
    //console.log('destPath: ', destPath);
    while (fs.existsSync(destPath) && counter <= MAX_RENAME_ATTEMPTS) {
        counter++;
        destPath = path.join(destDir, `${base}-${counter}${ext}`);
    }

    if (fs.existsSync(destPath)) {
        vscode.window.showErrorMessage('Cannot create unique file name, too many duplicates.');
        return null;
    }
  }
  //console.log('Destination path:', destPath);

  // Copy PDF
  try {
    const arrayBuffer = await fileItem.data();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    console.log('Copied PDF to:', destPath);
  } catch (err) {
    console.error('Failed to copy PDF:', err);
    vscode.window.showErrorMessage('Failed to copy PDF: ' + (err as Error).message);
    return null;
  }

  // Create Markdown link
  const relPath = path.relative(path.dirname(document.uri.fsPath), destPath).replace(/\\/g, '/');
  //const linkText = `[${path.basename(destPath)}](${relPath})`;
  const linkText = `[[${relPath}|${fileItem.name}]]`;
  //console.log('Markdown link inserted:', linkText);

  const wsEdit = new vscode.WorkspaceEdit();
  wsEdit.createFile(vscode.Uri.file(destPath), { ignoreIfExists: true });

  return { linkText, wsEdit };

}

async function copyFileAndGenerateLink_v2(
  document: vscode.TextDocument,
  fileUri: vscode.Uri,
  wsEdit: vscode.WorkspaceEdit
): Promise<string | null> {

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log('No workspace folder found');
    vscode.window.showErrorMessage('File drop failed: no workspace folder detected.');
    return null;
  }

  console.log(`document path: ${document.uri.fsPath}`);
  console.log(`file path: ${fileUri.fsPath}`);

    // Compute path of Markdown file relative to workspace
  let markdownRelative = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath).replace(/\\/g, '/');
  //console.log('Markdown relative path:', markdownRelative);

  // Read user markdown.copyFiles.destination
  const config = vscode.workspace.getConfiguration('markdown');
  const destinations = config.get<Record<string, string>>('copyFiles.destination') ?? {};
  //console.log('markdown.copyFiles.destination:', destinations);
  vscode.window.showInformationMessage('destinations: ');
  for (const [pattern, folder] of Object.entries(destinations)) {
    //vscode.window.showInformationMessage('pattern: ' + pattern);
  }
  
  // Read user markdown.copyFiles.overwriteBehavior
  const overwriteBehavior = config.get<'overwrite' | 'nameIncrementally'>('copyFiles.overwriteBehavior') ?? 'nameIncrementally';
  //console.log('markdown.copyFiles.overwriteBehavior:', overwriteBehavior);

  // Find first glob that matches the Markdown file
  let destTemplate: string | undefined;
  for (const [pattern, folder] of Object.entries(destinations)) {
    if (minimatch.minimatch(markdownRelative, pattern)) {
      destTemplate = folder;
      //console.log(`Pattern matched: ${pattern} → ${folder}`);
      break;
    }
  }

  if (!destTemplate) {
    destTemplate = 'assets/';
    console.log('No matching glob, using default folder:', destTemplate);
  }

  // Expand ${documentBaseName}
  const docBase = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
  //console.log('docBase:', docBase);
  destTemplate = destTemplate.replace(/\$\{documentBaseName\}/g, docBase);
  //console.log('destTemplate:', destTemplate);

  // Destination folder relative to Markdown file
  const destDir = path.join(path.dirname(document.uri.fsPath), destTemplate);

  // Ensure folder exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('Created folder:', destDir);
  }
  
  //let destPath = path.join(destDir, fileItem.name);
  let destFileName = path.basename(fileUri.fsPath);
  let destPath = path.join(destDir, destFileName);
  
  // Handle rename if needed
  if (fs.existsSync(destPath) && overwriteBehavior === 'nameIncrementally') {
    const MAX_RENAME_ATTEMPTS = 100;
    let counter = 1;
    //const base = path.basename(fileItem.name, path.extname(fileItem.name));
    //const ext = path.extname(fileItem.name);
    const ext = path.extname(destFileName);
    const base = path.basename(destFileName, ext);
    destPath = path.join(destDir, `${base}-${counter}${ext}`);
    //console.log('destPath: ', destPath);
    while (fs.existsSync(destPath) && counter <= MAX_RENAME_ATTEMPTS) {
        counter++;
        destPath = path.join(destDir, `${base}-${counter}${ext}`);
    }

    if (fs.existsSync(destPath)) {
        vscode.window.showErrorMessage('Cannot create unique file name, too many duplicates.');
        return null;
    }
  }
  //console.log('Destination path:', destPath);

  // Copy PDF
  /*try {
    const arrayBuffer = await fileItem.data();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    console.log('Copied PDF to:', destPath);
  } catch (err) {
    console.error('Failed to copy PDF:', err);
    vscode.window.showErrorMessage('Failed to copy PDF: ' + (err as Error).message);
    return null;
  }*/
  //fs.copyFileSync(fileUri.fsPath, destPath);
  const destinationUri: vscode.Uri = vscode.Uri.file(destPath);
  //await vscode.workspace.fs.copy(fileUri, destinationUri, { overwrite: true });
  //wsEdit.deleteFile(destinationUri, { ignoreIfNotExists: true });
  wsEdit.createFile(destinationUri, { ignoreIfExists: true });
  //const fileContent = await vscode.workspace.fs.readFile(fileUri);
  //wsEdit.createFile(destinationUri, { ignoreIfExists: true, content: fileContent });
  await vscode.workspace.fs.copy(fileUri, destinationUri, { overwrite: true });

  // Create Markdown link
  const relPath = path.relative(path.dirname(document.uri.fsPath), destPath).replace(/\\/g, '/');
  //const linkText = `[${path.basename(destPath)}](${relPath})`;
  const linkText = `[[${relPath}|${destFileName}]]`;
  //console.log('Markdown link inserted:', linkText);

  //const wsEdit = new vscode.WorkspaceEdit();
  //wsEdit.createFile(vscode.Uri.file(destPath), { ignoreIfExists: true });

  //return { linkText, wsEdit };
  return linkText;

}

async function getDestPath(
  document: vscode.TextDocument,
  fileUri: vscode.Uri,
): Promise<string | null> {

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log('No workspace folder found');
    vscode.window.showErrorMessage('File drop failed: no workspace folder detected.');
    return null;
  }

  console.log(`document path: ${document.uri.fsPath}`);
  console.log(`file path: ${fileUri.fsPath}`);

  // Compute path of Markdown file relative to workspace
  let markdownRelative = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath).replace(/\\/g, '/');
  //console.log('Markdown relative path:', markdownRelative);

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

  if (!destTemplate) {
    destTemplate = '_assets/';
    console.log('No matching glob, using default folder:', destTemplate);
  }

  // Expand ${documentBaseName}
  const docBase = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
  destTemplate = destTemplate.replace(/\$\{documentBaseName\}/g, docBase);

  // Destination folder relative to Markdown file
  const destDir = path.join(path.dirname(document.uri.fsPath), destTemplate);

  //let destPath = path.join(destDir, fileItem.name);
  let destFileName = path.basename(fileUri.fsPath);
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

  console.log('Destination path:', destPath);
  return destPath;

}


/**
 * Activate extension
 */
export function activate(context: vscode.ExtensionContext) {

  vscode.window.showInformationMessage('Extend Media Files extension activated');

  const extString: string = vscode.workspace
    .getConfiguration('extendMediaFiles')
    .get('extensions') ?? 'pdf';

  // Split by comma, trim spaces, convert to lowercase
  const allowedExtensions = extString.split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  console.log('Allowed extensions:', allowedExtensions);

  // --- Drag and Drop provider ---
  /*
  const dropProvider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(document, position, dataTransfer, token) {

      const pdfItem = dataTransfer.get('application/pdf');
      if (!pdfItem) return null;

      const pdfFile = await pdfItem.asFile();
      if (!pdfFile) return null;

      const result = await copyFileAndGenerateLink(document, pdfFile);
      if (!result) return null;

      const dropEdit = new vscode.DocumentDropEdit(new vscode.SnippetString(result.linkText));
      dropEdit.additionalEdit = result.wsEdit;
      return dropEdit;
    }
  };
  */
  let dropProvider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(document, position, dataTransfer, token) {

      const uriListItem = dataTransfer.get('text/uri-list');
      if (!uriListItem) return null;

      const uriListText = await uriListItem.asString();
      if (!uriListText) return null;

      // Split into individual file URIs
      const uris = uriListText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => vscode.Uri.parse(line));

      const links: string[] = [];
      const wsEdit = new vscode.WorkspaceEdit();

      for (const uri of uris) {

        console.log(`uri.fsPath 1: ${uri.fsPath}`);

        const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
        if (!allowedExtensions.includes(ext)) continue;

        console.log(`uri.fsPath 2: ${uri.fsPath}`);

        //const content = await vscode.workspace.fs.readFile(uri);
        const destFolder = path.dirname(document.uri.fsPath);
        const destPath = path.join(destFolder, path.basename(uri.fsPath));
        const destUri = vscode.Uri.file(destPath);
        wsEdit.createFile(destUri, { overwrite: true });
        await vscode.workspace.fs.copy(uri, destUri);

        break;

        // Use your existing copy + link generation function
        //const result = await copyFileAndGenerateLink_v2(document, uri, wsEdit);
        //if (!result) continue;

        //links.push(result);
        
        /*links.push(result.linkText);
        if (result.wsEdit) {
          for (const [uri, textEdits] of result.wsEdit.entries()) {
            for (const te of textEdits) {
              wsEdit.replace(uri, te.range, te.newText);
            }
          }
        }*/
      }

      // Single drop edit for all links
      if (links.length === 0) return null;

      //const dropEdit = new vscode.DocumentDropEdit(new vscode.SnippetString(links.join('\n')));
      const dropEdit = new vscode.DocumentDropEdit(new vscode.SnippetString('hi'));
      dropEdit.additionalEdit = wsEdit;
      return dropEdit;

    }
  };

  dropProvider = {
    async provideDocumentDropEdits(document, position, dataTransfer, token) {
      getDestPath

      for (const [mime, item] of dataTransfer) {
        const file = item.asFile();
        if (!file) {
          continue;
        }

        const additionalEdit = new vscode.WorkspaceEdit();
        additionalEdit.createFile(vscode.Uri.joinPath(document.uri, '..', file.name), {
          contents: file,
          ignoreIfExists: true
        });

        return {
          insertText: file.name,
          additionalEdit
        };
      }

    }
  };


  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider({ language: 'markdown' }, dropProvider)
  );


  // --- Copy-paste provider ---
  const pasteProvider: vscode.DocumentPasteEditProvider = {
    async provideDocumentPasteEdits(document, ranges, dataTransfer, context, token) {
      console.log("provideDocumentPasteEdits");

      const uriListItem = dataTransfer.get('text/uri-list');
      if (!uriListItem) return null;

      const uriListText = await uriListItem.asString();
      if (!uriListText) return null;

      // Split into individual file URIs
      const uris = uriListText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => vscode.Uri.parse(line));

      const links: string[] = [];
      const wsEdit = new vscode.WorkspaceEdit();

      for (const uri of uris) {
        console.log(`uri.fsPath 3: ${uri.fsPath}`);
        const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
        if (!allowedExtensions.includes(ext)) continue;

        console.log(`uri.fsPath 4: ${uri.fsPath}`);

        // Use your existing copy + link generation function
        const result = await copyFileAndGenerateLink_v2(document, uri, wsEdit);
        if (!result) continue;

        links.push(result);

        /*links.push(result.linkText);
        if (result.wsEdit) {
          for (const [uri, textEdits] of result.wsEdit.entries()) {
            for (const te of textEdits) {
              wsEdit.replace(uri, te.range, te.newText);
            }
          }
        }*/

      }

      // Single drop edit for all links
      if (links.length === 0) return null;

      const pasteEdit = new vscode.DocumentPasteEdit(
        links.join('\n'),
        'Insert Link',
        vscode.DocumentDropOrPasteEditKind.Text
      );
      pasteEdit.additionalEdit = wsEdit;
      return [ pasteEdit ];

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
