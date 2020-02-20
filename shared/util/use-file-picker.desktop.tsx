import * as Electron from 'electron'
import * as React from 'react'
import {showOpenDialog, showSaveDialog} from '../actions/platform-specific'
import {usePrevious} from './container'

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
