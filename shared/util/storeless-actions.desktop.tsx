import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'

const {showMainWindow, ctlQuit, dumpNodeLogger, setOpenAtLogin, copyToClipboard: copyText} = KB2.functions

export const copyToClipboard = (text: string) => {
  copyText?.(text)
}

export const dumpLogs = async (reason?: string) => {
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  if (reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

export const filePickerError = (_error: Error) => {}

export const onEngineConnected = () => {
  const f = async () => {
    await T.RPCGen.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
  }
  ignorePromise(f())
}

export const openAppSettings = () => {}

export const openAppStore = () => {}

export const persistRoute = (_clear: boolean, _immediate: boolean, _isStartupLoaded: () => boolean) => {}

export const setOpenAtLoginInPlatform = async (openAtLogin: boolean) => {
  await setOpenAtLogin?.(openAtLogin)
}

export const showMain = () => {
  showMainWindow?.()
}

export const showShareActionSheet = (_filePath: string, _message: string, _mimeType: string) => {}
