import * as SafeElectron from './safe-electron.desktop'
import fs from 'fs'
import {tmpRandFile} from './file.desktop'

export type ClipboardData = {
  path: string
  title: string
}

function readImage(): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
      resolve(null)
    })
  }
}

// If you want to read from the HTML5 file blob, use readBlob via:
//   let items = event.clipboardData.items
//   let blob = items[1].getAsFile()
// eslint-disable-next-line
function readBlob(name: string, format: string, blob: any): Promise<ClipboardData | null> {
  return new Promise((resolve, reject) => {
    // We get the data from the HTML5 File object, read it into a
    // buffer and then save it to disk.
    // If we wanted the Electron NativeImage, we could use
    // clipboard.readImage() but we want the raw data since
    // NativeImage only supports JPG and PNG.
    // Unfortunately, there is no clipboard read method that gives
    // us a buffer object.
    tmpRandFile(name).then(path => {
      console.log('Saving clipboard to:', path)
      let reader = new FileReader() // eslint-disable-line
      reader.onload = e => {
        // @ts-ignore codemod-issue
        fs.writeFile(path, Buffer.from(e.target.result), err => {
          if (err) {
            reject(err)
            return
          }
          // @ts-ignore codemod-issue
          resolve({format, path, title: name})
        })
      }
      reader.readAsArrayBuffer(blob)
    })
  })
}
