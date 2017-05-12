// @flow
import {clipboard} from 'electron'
import fs from 'fs'
import {tmpRandFile} from './file.desktop'

export type ClipboardData = {
  path: string,
  title: string,
}

function readImage(): Promise<?ClipboardData> {
  return new Promise((resolve, reject) => {
    tmpRandFile('.png').then(path => {
      const image = clipboard.readImage()
      if (!image) {
        // Nothing to read
        resolve(null)
        return
      }
      const data = image.toPNG()

      console.log('Saving image from clipboard to', path)
      fs.writeFile(path, data, err => {
        if (err) {
          reject(err)
          return
        }
        resolve({path, title: 'Pasted image'})
      })
    })
  })
}

export function readImageFromClipboard(
  event: any,
  willReadData: () => void
): Promise<?ClipboardData> {
  const formats = clipboard.availableFormats()
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
function readBlob(
  name: string,
  format: string,
  blob: any
): Promise<?ClipboardData> {
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
      // eslint-disable-next-line
      let reader = new FileReader()
      reader.onload = e => {
        fs.writeFile(path, Buffer.from(e.target.result), err => {
          if (err) {
            reject(err)
            return
          }
          resolve({format, path, title: name})
        })
      }
      reader.readAsArrayBuffer(blob)
    })
  })
}
