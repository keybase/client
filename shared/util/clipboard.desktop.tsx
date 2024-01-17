import KB2 from './electron.desktop'
const {clipboardAvailableFormats} = KB2.functions

export async function readImageFromClipboard(_event: React.SyntheticEvent): Promise<Uint8Array | undefined> {
  const formats = await (clipboardAvailableFormats?.() ?? new Array<string>())
  console.log('Read clipboard, formats:', formats)
  // Read image from Electron clipboard
  return KB2.functions.readImageFromClipboard?.() ?? undefined
}
