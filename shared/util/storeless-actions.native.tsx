import * as Clipboard from 'expo-clipboard'
import {Alert, Linking} from 'react-native'
import * as Tabs from '@/constants/tabs'
import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {getTab, getVisiblePath} from '@/constants/router'
import {isAndroid} from '@/constants/platform.native'
import {showShareActionSheet as showShareActionSheetImpl} from '@/util/platform-specific'

export const copyToClipboard = (text: string) => {
  Clipboard.setStringAsync(text)
    .then(() => {})
    .catch(() => {})
}

export const dumpLogs = async (_reason?: string) => {}

export const filePickerError = (error: Error) => {
  Alert.alert('Error', String(error))
}

export const onEngineConnected = () => {}

export const openAppSettings = () => {
  ignorePromise(Linking.openSettings())
}

export const openAppStore = () => {
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
    let routeName = Tabs.peopleTab
    const cur = getTab()
    if (cur) {
      routeName = cur
    }
    const ap = getVisiblePath()
    ap.some((r: ReturnType<typeof getVisiblePath>[number]) => {
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

export const setOpenAtLoginInPlatform = async (_openAtLogin: boolean) => {}

export const showMain = () => {}

export const showShareActionSheet = (filePath: string, message: string, mimeType: string) => {
  const f = async () => {
    await showShareActionSheetImpl({filePath, message, mimeType})
  }
  ignorePromise(f())
}
