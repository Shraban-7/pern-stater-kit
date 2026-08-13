import JSZip from 'jszip';

export type LocalFile = { path: string; contents: string };

async function writeTree(
  root: FileSystemDirectoryHandle,
  files: LocalFile[],
): Promise<void> {
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.contents);
    await writable.close();
  }
}

export async function downloadZip(
  project: string,
  files: LocalFile[],
): Promise<{ mode: 'folder' | 'zip'; detail: string }> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.contents);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project}.zip`;
  link.click();
  URL.revokeObjectURL(url);
  return {
    mode: 'zip',
    detail: `Downloaded ${project}.zip. Unzip it on this computer.`,
  };
}

export async function saveProjectLocally(
  project: string,
  files: LocalFile[],
): Promise<{ mode: 'folder' | 'zip'; detail: string }> {
  const pick = window.showDirectoryPicker;
  if (!pick) return downloadZip(project, files);

  const parent = await pick({
    id: 'pern-starter',
    mode: 'readwrite',
    startIn: 'documents',
  });
  const folder = await parent.getDirectoryHandle(project, { create: true });
  await writeTree(folder, files);
  return {
    mode: 'folder',
    detail: `Saved ${files.length} files into ${project} on this computer.`,
  };
}
