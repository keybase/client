import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import type {KB2} from '@/util/electron'

const getKB2 = () => (require('@/util/electron') as {default: KB2}).default

export const copyToClipboard = (text: string) => {
  if (isMobile) {
    const Clipboard = require('expo-clipboard') as {setStringAsync: (text: string) => Promise<void>}
    Clipboard.setStringAsync(text)
      .then(() => {})
      .catch(() => {})
  } else {
    const {copyToClipboard: copyText} = getKB2().functions
    copyText?.(text)
  }
}

export const dumpLogs = async (reason?: string) => {
  if (isMobile) {
    return
  }
  const {dumpNodeLogger, ctlQuit} = getKB2().functions
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  if (reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

export const filePickerError = (error: Error) => {
  if (isMobile) {
    const {Alert} = require('react-native') as {Alert: {alert: (title: string, msg: string) => void}}
    Alert.alert('Error', String(error))
  }
}

export const onEngineConnected = () => {
  if (isMobile) {
    return
  }
  const KB2 = getKB2()
  const f = async () => {
    await T.RPCGen.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
  }
  ignorePromise(f())
}

export const openAppSettings = () => {
  if (isMobile) {
    const {Linking} = require('react-native') as {Linking: {openSettings: () => Promise<void>}}
    ignorePromise(Linking.openSettings())
  }
}

export const openAppStore = () => {
  if (!isMobile) {
    return
  }
  const {Linking} = require('react-native') as {Linking: {openURL: (url: string) => Promise<void>}}
  ignorePromise(
    Linking.openURL(
      isAndroid
        ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
        : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
    ).catch(() => {})
  )
}

let lastPersist = ''

export const persistRoute = (clear: boolean, immediate: boolean, isStartupLoaded: () => boolean) => {
  if (!isMobile) {
    return
  }
  const {timeoutPromise} = require('@/constants/utils') as {timeoutPromise: (ms: number) => Promise<void>}
  const {getTab, getVisiblePath} = require('@/constants/router') as {
    getTab: () => string | undefined
    getVisiblePath: () => Array<{name: string; params?: unknown}>
  }
  const {peopleTab} = require('@/constants/tabs') as {peopleTab: string}

  const doClear = async () => {
    try {
      await T.RPCGen.configGuiSetValueRpcPromise({
        path: 'ui.routeState2',
        value: {isNull: false, s: ''},
      })
    } catch {}
  }

  const doPersist = async () => {
    if (!isStartupLoaded()) {
      return
    }
    let param = {}
    let routeName = peopleTab
    const cur = getTab()
    if (cur) {
      routeName = cur
    }
    const ap = getVisiblePath()
    ap.some((r: {name: string; params?: unknown}) => {
      if (r.name === 'chatConversation') {
        const rParams = r.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
        param = {selectedConversationIDKey: rParams?.conversationIDKey}
        return true
      }
      return false
    })
    const next = JSON.stringify({param, routeName})
    if (lastPersist === next) {
      return
    }
    lastPersist = next

    try {
      await T.RPCGen.configGuiSetValueRpcPromise({
        path: 'ui.routeState2',
        value: {isNull: false, s: next},
      })
    } catch {}
  }

  const run = clear ? doClear : doPersist
  if (immediate) {
    ignorePromise(run())
  } else {
    const f = async () => {
      await timeoutPromise(1000)
      await run()
    }
    ignorePromise(f())
  }
}

export const setOpenAtLoginInPlatform = async (openAtLogin: boolean) => {
  if (isMobile) {
    return
  }
  const {setOpenAtLogin} = getKB2().functions
  await setOpenAtLogin?.(openAtLogin)
}

export const showMain = () => {
  if (isMobile) {
    return
  }
  const {showMainWindow} = getKB2().functions
  showMainWindow?.()
}

export const showShareActionSheet = (filePath: string, message: string, mimeType: string) => {
  if (!isMobile) {
    return
  }
  const {showShareActionSheet: showShareActionSheetImpl} = require('@/util/platform-specific') as {
    showShareActionSheet: (opts: {filePath: string; message: string; mimeType: string}) => Promise<unknown>
  }
  const f = async () => {
    await showShareActionSheetImpl({filePath, message, mimeType})
  }
  ignorePromise(f())
}
