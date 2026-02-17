import {ignorePromise, neverThrowPromiseFunc, timeoutPromise} from '../utils'
import {storeRegistry} from '../store-registry'
import * as T from '../types'
import * as Clipboard from 'expo-clipboard'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as MediaLibrary from 'expo-media-library'
import * as Tabs from '../tabs'
import * as NetInfo from '@react-native-community/netinfo'
import NotifyPopup from '@/util/notify-popup'
import {addNotificationRequest} from 'react-native-kb'
import logger from '@/logger'
import {Alert, Linking, ActionSheetIOS} from 'react-native'
import {isIOS, isAndroid} from '../platform.native'
import {wrapErrors} from '@/util/debug'
import {getTab, getVisiblePath, switchTab} from '../router2'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {setupAudioMode} from '@/util/audio.native'
import {
  androidOpenSettings,
  androidShare,
  androidShareText,
  androidUnlink,
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
  guiConfig,
} from 'react-native-kb'
import {initPushListener, getStartupDetailsFromInitialPush} from './push.native'
import type {ImageInfo} from '@/util/expo-image-picker.native'
import {noConversationIDKey} from '@/constants/types/chat2/common'

export const requestPermissionsToWrite = async () => {
  if (isAndroid) {
    const p = await MediaLibrary.requestPermissionsAsync(false)
    return p.granted ? Promise.resolve() : Promise.reject(new Error('Unable to acquire storage permissions'))
  }
  return Promise.resolve()
}

export const requestLocationPermission = async (mode: T.RPCChat.UIWatchPositionPerm) => {
  if (isIOS) {
    logger.info('[location] Requesting location perms', mode)
    switch (mode) {
      case T.RPCChat.UIWatchPositionPerm.base:
        {
          const iosFGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
          if (iosFGPerms.ios?.scope === 'none') {
            throw new Error('Please allow Keybase to access your location in the phone settings.')
          }
        }
        break
      case T.RPCChat.UIWatchPositionPerm.always: {
        const iosBGPerms = await ExpoLocation.requestBackgroundPermissionsAsync()
        if (iosBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
          throw new Error(
            'Please allow Keybase to access your location even if the app is not running for live location.'
          )
        }
        break
      }
    }
  } else if (isAndroid) {
    const androidBGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
    if (androidBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
      throw new Error('Unable to acquire location permissions')
    }
  }
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType: 'video' | 'photo' = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  try {
    try {
      // see it we can keep going anyways, android perms are needed sometimes and sometimes not w/ 33
      await requestPermissionsToWrite()
    } catch {}
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await MediaLibrary.saveToLibraryAsync(fileURL)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    // This can fail if the user backgrounds too quickly, so throw up a local notification
    // just in case to get their attention.
    addNotificationRequest({
      body: `Failed to save ${saveType} to camera roll`,
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    }).catch(() => {})
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    try {
      await androidUnlink(filePath)
    } catch {
      logger.warn('failed to unlink')
    }
  }
}

export const showShareActionSheet = async (options: {
  filePath?: string
  message?: string
  mimeType: string
}) => {
  if (isIOS) {
    return new Promise((resolve, reject) => {
      ActionSheetIOS.showShareActionSheetWithOptions(
        {
          message: options.message,
          url: options.filePath,
        },
        reject,
        resolve
      )
    })
  } else {
    if (!options.filePath && options.message) {
      try {
        await androidShareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (e) {
        throw new Error('Failed to share: ' + String(e))
      }
    }

    try {
      await androidShare(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch (e) {
      throw new Error('Failed to share: ' + String(e))
    }
  }
}

const loadStartupDetails = async () => {
  const [routeState, initialUrl, push] = await Promise.all([
    neverThrowPromiseFunc(async () => {
      try {
        const config = JSON.parse(guiConfig) as {ui?: {routeState2?: string}} | undefined
        return Promise.resolve(config?.ui?.routeState2 ?? '')
      } catch {
        return Promise.resolve('')
      }
    }),
    neverThrowPromiseFunc(async () => Linking.getInitialURL()),
    neverThrowPromiseFunc(getStartupDetailsFromInitialPush),
  ] as const)

  let conversation: T.Chat.ConversationIDKey | undefined
  let followUser = ''
  let link = ''
  let tab = ''

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    conversation = push.startupConversation
    followUser = push.startupFollowUser ?? ''
  } else if (initialUrl) {
    // Second priority, deep link
    link = initialUrl
  } else if (routeState) {
    // Last priority, saved from last session
    try {
      const item = JSON.parse(routeState) as
        | undefined
        | {param?: {selectedConversationIDKey?: unknown}; routeName?: string}
      if (item) {
        const _convo = item.param?.selectedConversationIDKey || undefined
        if (typeof _convo === 'string') {
          conversation = _convo
          logger.info('initialState: routeState', conversation)
        }
        const _rn = item.routeName || undefined
        if (typeof _rn === 'string') {
          tab = _rn as unknown as typeof tab
        }
      }
    } catch {
      logger.info('initialState: routeState parseFail')
      conversation = undefined
      tab = ''
    }
  }

  // never allow this case
  if (tab === 'blank') {
    tab = ''
  }

  storeRegistry.getState('config').dispatch.setStartupDetails({
    conversation: conversation ?? noConversationIDKey,
    followUser,
    link,
    tab: tab as Tabs.Tab,
  })

  // Clear last value to be extra safe bad things don't hose us forever (don't block startup)
  ignorePromise(
    T.RPCGen.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    }).catch(() => {})
  )
}

const setPermissionDeniedCommandStatus = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  storeRegistry.getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: text,
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  })
}

const onChatWatchPosition = async (action: EngineGen.Chat1ChatUiChatWatchPositionPayload) => {
  const response = action.payload.response
  response.result(0)
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location perms: ' + error.message)
    setPermissionDeniedCommandStatus(
      T.Chat.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${error.message}`
    )
  }

  locationRefs++

  if (locationRefs === 1) {
    try {
      logger.info(
        '[location] location watch start due to ',
        T.Chat.conversationIDToKey(action.payload.params.convID)
      )
      ensureBackgroundTask()
      await ExpoLocation.startLocationUpdatesAsync(locationTaskName, {
        deferredUpdatesDistance: 65,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
      })
      logger.info('[location] start success')
    } catch {
      logger.info('[location] start failed')
      locationRefs--
    }
  }
}

const onChatClearWatch = async () => {
  locationRefs--
  if (locationRefs <= 0) {
    try {
      logger.info('[location] end start')
      ensureBackgroundTask()
      await ExpoLocation.stopLocationUpdatesAsync(locationTaskName)
      logger.info('[location] end success')
    } catch {
      logger.info('[location] end failed')
    }
  }
}

const locationTaskName = 'background-location-task'
let locationRefs = 0
let madeBackgroundTask = false

const ensureBackgroundTask = () => {
  if (madeBackgroundTask) return
  madeBackgroundTask = true

  ExpoTaskManager.defineTask(locationTaskName, async ({data, error}) => {
    if (error) {
      // check `error.message` for more details.
      return Promise.resolve()
    }

    if (!data) {
      return Promise.resolve()
    }
    const d = data as {locations?: Array<ExpoLocation.LocationObject>}
    const locations = d.locations
    if (!locations?.length) {
      return Promise.resolve()
    }
    const pos = locations.at(-1)
    const coord = {
      accuracy: Math.floor(pos?.coords.accuracy ?? 0),
      lat: pos?.coords.latitude ?? 0,
      lon: pos?.coords.longitude ?? 0,
    }

    storeRegistry.getState('chat').dispatch.updateLastCoord(coord)
    return Promise.resolve()
  })
}

export const watchPositionForMap = async (conversationIDKey: T.Chat.ConversationIDKey) => {
  try {
    logger.info('[location] perms check due to map')
    await requestLocationPermission(T.RPCChat.UIWatchPositionPerm.base)
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location perms: ' + error.message)
    setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
    return () => {}
  }

  try {
    const sub = await ExpoLocation.watchPositionAsync(
      {accuracy: ExpoLocation.LocationAccuracy.Highest},
      location => {
        const coord = {
          accuracy: Math.floor(location.coords.accuracy ?? 0),
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        }
        storeRegistry.getState('chat').dispatch.updateLastCoord(coord)
      }
    )
    return () => sub.remove()
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location: ' + error.message)
    setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
    return () => {}
  }
}

export const initPlatformListener = () => {
  let _lastPersist = ''
  storeRegistry.getStore('config').setState(s => {
    s.dispatch.dynamic.persistRoute = wrapErrors((clear: boolean, immediate: boolean) => {
      const doClear = async () => {
        try {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: 'ui.routeState2',
            value: {isNull: false, s: ''},
          })
        } catch {}
      }
      const doPersist = async () => {
        if (!storeRegistry.getState('config').startup.loaded) {
          return
        }
        let param = {}
        let routeName = Tabs.peopleTab
        const cur = getTab()
        if (cur) {
          routeName = cur
        }
        const ap = getVisiblePath()
        ap.some(r => {
          if (r.name === 'chatConversation') {
            const rParams = r.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
            param = {selectedConversationIDKey: rParams?.conversationIDKey}
            return true
          }
          return false
        })
        const s = JSON.stringify({param, routeName})
        // don't keep rewriting
        if (_lastPersist === s) {
          return
        }
        _lastPersist = s

        try {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: 'ui.routeState2',
            value: {isNull: false, s},
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
    })

    s.dispatch.dynamic.onEngineIncomingNative = wrapErrors((action: EngineGen.Actions) => {
      switch (action.type) {
        default:
      }
    })
  })

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    let appFocused: boolean
    let logState: T.RPCGen.MobileAppState
    switch (s.mobileAppState) {
      case 'active':
        appFocused = true
        logState = T.RPCGen.MobileAppState.foreground
        break
      case 'background':
        appFocused = false
        logState = T.RPCGen.MobileAppState.background
        storeRegistry.getState('config').dispatch.dynamic.persistRoute?.(false, true)
        break
      case 'inactive':
        appFocused = false
        logState = T.RPCGen.MobileAppState.inactive
        break
      default:
        appFocused = false
        logState = T.RPCGen.MobileAppState.foreground
    }

    logger.info(`setting app state on service to: ${logState}`)
    storeRegistry.getState('config').dispatch.changedFocus(appFocused)
  })

  storeRegistry.getStore('config').setState(s => {
    s.dispatch.dynamic.copyToClipboard = wrapErrors((s: string) => {
      Clipboard.setStringAsync(s)
        .then(() => {})
        .catch(() => {})
    })
  })

  const configureAndroidCacheDir = () => {
    if (isAndroid && fsCacheDir && fsDownloadDir) {
      ignorePromise(
        T.RPCChat.localConfigureFileAttachmentDownloadLocalRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
          .then(() => {})
          .catch((e: unknown) => {
            logger.error(`[Android cache override] Failed to configure: ${String(e)}`)
          })
      )
    } else if (isAndroid) {
      logger.warn(
        `[Android cache override] Missing dirs - cacheDir: ${fsCacheDir}, downloadDir: ${fsDownloadDir}`
      )
    }
  }

  storeRegistry.getStore('daemon').subscribe((s, old) => {
    const versionChanged = s.handshakeVersion !== old.handshakeVersion
    const stateChanged = s.handshakeState !== old.handshakeState
    const justBecameReady = stateChanged && s.handshakeState === 'done' && old.handshakeState !== 'done'

    if (versionChanged || justBecameReady) {
      configureAndroidCacheDir()
    }
  })

  storeRegistry.getStore('config').setState(s => {
    s.dispatch.dynamic.onFilePickerError = wrapErrors((error: Error) => {
      Alert.alert('Error', String(error))
    })
    s.dispatch.dynamic.openAppStore = wrapErrors(() => {
      Linking.openURL(
        isAndroid
          ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
          : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
      ).catch(() => {})
    })
  })

  storeRegistry.getStore('profile').setState(s => {
    s.dispatch.editAvatar = () => {
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync('photo')
          const first = result.assets?.reduce<ImageInfo | undefined>((acc, a) => {
            if (!acc && (a.type === 'image' || a.type === 'video')) {
              return a as ImageInfo
            }
            return acc
          }, undefined)
          if (!result.canceled && first) {
            storeRegistry
              .getState('router')
              .dispatch.navigateAppend({props: {image: first}, selected: 'profileEditAvatar'})
          }
        } catch (error) {
          storeRegistry.getState('config').dispatch.filePickerError(new Error(String(error)))
        }
      }
      ignorePromise(f())
    }
  })

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const f = async () => {
      const {type} = await NetInfo.fetch()
      storeRegistry
        .getState('config')
        .dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type, true)
    }
    ignorePromise(f())
  })

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    const type = s.networkStatus?.type
    if (!type) return
    const f = async () => {
      try {
        await T.RPCGen.appStateUpdateMobileNetStateRpcPromise({state: type})
      } catch (err) {
        console.warn('Error sending mobileNetStateUpdate', err)
      }
    }
    ignorePromise(f())
  })

  storeRegistry.getStore('config').setState(s => {
    s.dispatch.dynamic.showShareActionSheet = wrapErrors(
      (filePath: string, message: string, mimeType: string) => {
        const f = async () => {
          await showShareActionSheet({filePath, message, mimeType})
        }
        ignorePromise(f())
      }
    )
  })

  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'active') {
      // only reload on foreground
      storeRegistry.getState('settings-contacts').dispatch.loadContactPermissions()
    }
  })

  // Location
  if (isAndroid) {
    storeRegistry.getStore('dark-mode').subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      const {darkModePreference} = storeRegistry.getState('dark-mode')
      androidAppColorSchemeChanged(darkModePreference)
    })
  }

  storeRegistry.getStore('router').subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    storeRegistry.getState('config').dispatch.dynamic.persistRoute?.(false, false)
  })

  // Start this immediately instead of waiting so we can do more things in parallel
  ignorePromise(loadStartupDetails())
  initPushListener()

  NetInfo.addEventListener(({type}) => {
    storeRegistry
      .getState('config')
      .dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type)
  })

  const initAudioModes = () => {
    ignorePromise(setupAudioMode(false))
  }
  initAudioModes()

  if (isAndroid) {
    const daemonState = storeRegistry.getState('daemon')
    if (daemonState.handshakeState === 'done' || daemonState.handshakeVersion > 0) {
      configureAndroidCacheDir()
    }
  }

  storeRegistry.getStore('config').setState(s => {
    s.dispatch.dynamic.openAppSettings = wrapErrors(() => {
      const f = async () => {
        if (isAndroid) {
          androidOpenSettings()
        } else {
          const settingsURL = 'app-settings:'
          const can = await Linking.canOpenURL(settingsURL)
          if (can) {
            await Linking.openURL(settingsURL)
          } else {
            logger.warn('Unable to open app settings')
          }
        }
      }
      ignorePromise(f())
    })

    s.dispatch.dynamic.onEngineIncomingNative = wrapErrors((action: EngineGen.Actions) => {
      switch (action.type) {
        case EngineGen.chat1ChatUiTriggerContactSync:
          storeRegistry.getState('settings-contacts').dispatch.manageContactsCache()
          break
        case EngineGen.keybase1LogUiLog: {
          const {params} = action.payload
          const {level, text} = params
          logger.info('keybase.1.logUi.log:', params.text.data)
          if (level >= T.RPCGen.LogLevel.error) {
            NotifyPopup(text.data)
          }
          break
        }
        case EngineGen.chat1ChatUiChatWatchPosition:
          ignorePromise(onChatWatchPosition(action))
          break
        case EngineGen.chat1ChatUiChatClearWatch:
          ignorePromise(onChatClearWatch())
          break
        default:
      }
    })
  })

  let _pendingFastSwitchTab: string | undefined
  storeRegistry.getStore('router').setState(s => {
    s.dispatch.dynamic.tabLongPress = wrapErrors((tab: string) => {
      if (tab !== Tabs.peopleTab) return
      const accountRows = storeRegistry.getState('config').configuredAccounts
      const current = storeRegistry.getState('current-user').username
      const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
      if (row) {
        _pendingFastSwitchTab = getTab() ?? undefined
        storeRegistry.getState('config').dispatch.setUserSwitching(true)
        storeRegistry.getState('config').dispatch.login(row.username, '')
      }
    })
  })

  storeRegistry.getStore('config').subscribe((state, prevState) => {
    const tab = _pendingFastSwitchTab
    if (!tab) return
    if (state.loggedIn && !prevState.loggedIn) {
      _pendingFastSwitchTab = undefined
      let attempts = 0
      const trySwitch = () => {
        if (attempts++ > 20) return
        if (getTab()) {
          switchTab(tab as Tabs.AppTab)
        } else {
          setTimeout(trySwitch, 100)
        }
      }
      setTimeout(trySwitch, 100)
    }
  })

  ignorePromise(storeRegistry.getState('fs').dispatch.setupSubscriptions())
}
