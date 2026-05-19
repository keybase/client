import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import logger from '@/logger'
import KB2 from '@/util/electron'
import {setStringAsync} from 'expo-clipboard'
import {Alert, Linking} from 'react-native'
import {showShareActionSheet as showShareActionSheetImpl} from '@/util/platform-specific'
import {getTab, getVisiblePath} from '@/constants/router'
import {peopleTab} from '@/constants/tabs'

export const copyToClipboard = (text: string) => {
  if (isMobile) {
    setStringAsync(text)
      .then(() => {})
      .catch(() => {})
  } else {
    KB2.functions.copyToClipboard?.(text)
  }
}

export const dumpLogs = async (reason?: string) => {
  if (isMobile) {
    return
  }
  const {dumpNodeLogger, ctlQuit} = KB2.functions
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  if (reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

export const filePickerError = (error: Error) => {
  if (isMobile) {
    Alert.alert('Error', String(error))
  }
}

export const onEngineConnected = () => {
  if (isMobile) {
    return
  }
  const f = async () => {
    await T.RPCGen.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
  }
  ignorePromise(f())
}

export const openAppSettings = () => {
  if (isMobile) {
    ignorePromise(Linking.openSettings())
  }
}

export const openAppStore = () => {
  if (!isMobile) {
    return
  }
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
  await KB2.functions.setOpenAtLogin?.(openAtLogin)
}

export const showMain = () => {
  if (isMobile) {
    return
  }
  KB2.functions.showMainWindow?.()
}

export const showShareActionSheet = (filePath: string, message: string, mimeType: string) => {
  if (!isMobile) {
    return
  }
  const f = async () => {
    await showShareActionSheetImpl({filePath, message, mimeType})
  }
  ignorePromise(f())
}
