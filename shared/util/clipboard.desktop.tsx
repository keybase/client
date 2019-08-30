import * as SafeElectron from './safe-electron.desktop'

export type ClipboardData = {
  path: string
  title: string
}

function readImage(): Promise<Buffer | null> {
  return new Promise(resolve => {
    const image = SafeElectron.getClipboard().readImage()
    if (!image) {
      // Nothing to read
      resolve(null)
      return
    }
    const data = image.toPNG()
    resolve(data)
  })
}

export function readImageFromClipboard(
  event: React.SyntheticEvent,
  willReadData: () => void
): Promise<Buffer | null> {
  const formats = SafeElectron.getClipboard().availableFormats()
  console.log('Read clipboard, formats:', formats)
  const imageFormats = formats.filter(f => f.startsWith('image/'))

  if (imageFormats.length > 0) {
    event.preventDefault()

    // Notify caller we're going to read some data
    willReadData()

    // Read image from Electron clipboard
    return readImage()
  } else {
    // Nothing to read
    return new Promise(resolve => {
      resolve(null)
    })
  }
}
