// @flow
import {clipboard} from 'electron'
import fs from 'fs'
import {tmpRandFile} from './file.desktop'

export type ClipboardData = {
  path: string,
  title: string,
  format: string,
}

function readBlob (name: string, format: string, blob: any): Promise<?ClipboardData> { // eslint-disable-line
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

function readImage (name: string, format: string): Promise<?ClipboardData> {
  return new Promise((resolve, reject) => {
    let data = clipboard.readImage().toPNG()
    let ext = '.png'
    tmpRandFile(ext).then(path => {
      console.log('Saving image from clipboard to', path)
      fs.writeFile(path, data, err => {
        if (err) {
          reject(err)
          return
        }
        resolve({format, path, title: name})
      })
    })
  })
}

export function readClipboard (event: any, willReadData: () => void): Promise<?ClipboardData> {
  // If a user pastes image data, there are 2 items, the filename and
  // the file.
  let formats = clipboard.availableFormats()
  let items = event.clipboardData.items
  if (formats.length === 2 && items.length === 2 && formats[0] === 'text/plain' && formats[1].startsWith('image/')) {
    event.preventDefault()

    // We can get the filename (not full path) from the clipboard
    // readText, since the HTML5 File object from getAsFile doesn't
    // have this information.
    const name = clipboard.readText()
    const format = formats[1]

    // Notify caller we're going to read some data
    willReadData()

    // If you want to read from the HTML5 file blob, use readBlob
    // let blob = items[1].getAsFile()
    // return readBlob(name, format, blob)

    // Read image from Electron clipboard
    return readImage(name, format)
  } else {
    // Nothing to read
    return new Promise((resolve, reject) => { resolve(null) })
  }
}
