import KB2 from './electron.desktop'
const {clipboardAvailableFormats} = KB2.functions

export async function readImageFromClipboard(event: React.SyntheticEvent): Promise<Uint8Array | undefined> {
  const formats = await (clipboardAvailableFormats?.() ?? [])
  console.log('Read clipboard, formats:', formats)
  const imageFormats = formats.filter(f => f.startsWith('image/'))

  if (imageFormats.length > 0) {
    event.preventDefault()

    // Read image from Electron clipboard
    return KB2.functions.readImageFromClipboard?.() ?? undefined
  } else {
    // Nothing to read
    return Promise.resolve(undefined)
  }
}
