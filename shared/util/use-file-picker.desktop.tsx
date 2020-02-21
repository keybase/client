import * as Electron from 'electron'
import * as React from 'react'
import logger from '../logger'
import {usePrevious} from './container'

export async function showSaveDialog(options: Electron.SaveDialogOptions) {
  try {
    const result = await Electron.remote.dialog.showSaveDialog(Electron.remote.getCurrentWindow(), options)
    return result
  } catch (err) {
    logger.warn('Unable to open save diaglog (Electron.showSaveDialog)')
    return
  }
}

export async function showOpenDialog(options: Electron.OpenDialogOptions) {
  try {
    const result = await Electron.remote.dialog.showOpenDialog(Electron.remote.getCurrentWindow(), options)
    return result
  } catch (err) {
    logger.warn('Unable to open save diaglog (Electron.showOpenDialog)')
    return
  }
}

export const useOpenFile = (
  toggleCounter: number,
  options: Electron.OpenDialogOptions,
  callback: (result: Electron.OpenDialogReturnValue) => void
) => {
  const prevCounter = usePrevious(toggleCounter) ?? 0
  React.useEffect(() => {
    async function showDialog(o: Electron.OpenDialogOptions) {
      const result = await showOpenDialog(o)
      if (result) {
        callback(result)
      }
    }

    if (toggleCounter > prevCounter) {
      showDialog(options)
    }
  }, [toggleCounter, prevCounter, options, callback])
}

export const useSaveFile = (
  toggleCounter: number,
  options: Electron.SaveDialogOptions,
  callback: (result: Electron.SaveDialogReturnValue) => void
) => {
  const prevCounter = usePrevious(toggleCounter) ?? 0
  React.useEffect(() => {
    async function showDialog(o: Electron.SaveDialogOptions) {
      const result = await showSaveDialog(o)
      if (result) {
        callback(result)
      }
    }
    if (toggleCounter > prevCounter) {
      showDialog(options)
    }
  }, [toggleCounter, prevCounter, options, callback])
}
