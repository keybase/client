// @flow
import {clipboard} from 'electron'
import fs from 'fs'
import os from 'os'
import {tmpRandFile} from './file.desktop'

export type ClipboardData = {
  path: string,
  title: string,
  format: string,
}

export function readClipboard (event: any, beforeSave: () => void): Promise<?ClipboardData> {
  return new Promise((resolve, reject) => {
    // If a user pastes image data, there are 2 items, the filename and
    // the file.
    let formats = clipboard.availableFormats()
    let items = event.clipboardData.items
    if (formats.length === 2 && items.length === 2 && formats[0] === 'text/plain' && formats[1].startsWith('image/')) {
      event.preventDefault()

      // We can get the filename (not full path) from the clipboard
      // readText, since the HTML5 File object from getAsFile doesn't
      // have this information.
      let name = clipboard.readText()

      // We get the data from the HTML5 File object, read it into a
      // buffer and then save it to disk.
      // If we wanted the Electron NativeImage, we could use
      // clipboard.readImage() but we want the raw data since
      // NativeImage only supports JPG and PNG.
      // Unfortunately, there is no clipboard read method that gives
      // us a buffer object.
      beforeSave()
      let blob = items[1].getAsFile()
      tmpRandFile(name).then(path => {
        console.log('Saving clipboard to:', path)
        let reader = new FileReader()
        reader.onload = e => {
          fs.writeFile(path, Buffer.from(e.target.result), err => {
            if (err) {
              reject(err)
              return
            }
            resolve({path, title: name, format: formats[1]})
          })
        }
        reader.readAsArrayBuffer(blob)
      })
    } else {
      //
      resolve(null)
    }
  })
}
