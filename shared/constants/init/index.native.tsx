// links all the stores together, stores never import this
import {ignorePromise, neverThrowPromiseFunc, timeoutPromise} from '../utils'
import {useChatState} from '@/stores/chat2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFSState} from '@/stores/fs'
import {useProfileState} from '@/stores/profile'
import {useRouterState} from '@/stores/router2'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as T from '@/constants/types'
import * as Clipboard from 'expo-clipboard'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as Tabs from '@/constants/tabs'
import * as NetInfo from '@react-native-community/netinfo'
import NotifyPopup from '@/util/notify-popup'
import logger from '@/logger'
import {Alert, Linking} from 'react-native'
import {isAndroid} from '@/constants/platform.native'
import {wrapErrors} from '@/util/debug'
import {getTab, getVisiblePath, logState} from '@/constants/router2'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {setupAudioMode} from '@/util/audio.native'
import {
  androidAddCompleteDownload,
  androidOpenSettings,
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
  guiConfig,
  shareListenersRegistered,
} from 'react-native-kb'
import {initPushListener, getStartupDetailsFromInitialPush} from './push-listener.native'
import {initSharedSubscriptions, _onEngineIncoming} from './shared'
import type {ImageInfo} from '@/util/expo-image-picker.native'
import {noConversationIDKey} from '../types/chat2/common'
import {getSelectedConversation} from '../chat2/common'
import {getConvoState} from '@/stores/convostate'
import {
  requestLocationPermission,
  saveAttachmentToCameraRoll,
  showShareActionSheet,
} from '@/util/platform-specific/index.native'
import * as FS from '@/constants/fs'
import {errorToActionOrThrow} from '@/stores/fs'
import * as Styles from '@/styles'

const finishedRegularDownloadIDs = new Set<string>()

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

  useConfigState.getState().dispatch.setStartupDetails({
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

    useChatState.getState().dispatch.updateLastCoord(coord)
    return Promise.resolve()
  })
}

const setPermissionDeniedCommandStatus = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
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

export const onEngineIncoming = (action: EngineGen.Actions) => {
  _onEngineIncoming(action)
  switch (action.type) {
    case EngineGen.chat1ChatUiTriggerContactSync:
      useSettingsContactsState.getState().dispatch.manageContactsCache()
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
}

export const initPlatformListener = () => {
  let _lastPersist = ''
  useConfigState.setState(s => {
    s.dispatch.defer.persistRoute = wrapErrors((clear: boolean, immediate: boolean) => {
      const doClear = async () => {
        try {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: 'ui.routeState2',
            value: {isNull: false, s: ''},
          })
        } catch {}
      }
      const doPersist = async () => {
        if (!useConfigState.getState().startup.loaded) {
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
  })

  useConfigState.subscribe((s, old) => {
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
        useConfigState.getState().dispatch.defer.persistRoute?.(false, true)
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
    s.dispatch.changedFocus(appFocused)

    if (appFocused && old.mobileAppState !== 'active') {
      const {dispatch} = getConvoState(getSelectedConversation())
      dispatch.loadMoreMessages({reason: 'foregrounding'})
      dispatch.markThreadAsRead()
    }
  })

  useConfigState.setState(s => {
    s.dispatch.defer.copyToClipboard = wrapErrors((s: string) => {
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

  useDaemonState.subscribe((s, old) => {
    const versionChanged = s.handshakeVersion !== old.handshakeVersion
    const stateChanged = s.handshakeState !== old.handshakeState
    const justBecameReady = stateChanged && s.handshakeState === 'done' && old.handshakeState !== 'done'

    if (versionChanged || justBecameReady) {
      configureAndroidCacheDir()
    }
  })

  useConfigState.setState(s => {
    s.dispatch.defer.onFilePickerError = wrapErrors((error: Error) => {
      Alert.alert('Error', String(error))
    })
    s.dispatch.defer.openAppStore = wrapErrors(() => {
      Linking.openURL(
        isAndroid
          ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
          : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
      ).catch(() => {})
    })
  })

  useProfileState.setState(s => {
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
            useRouterState
              .getState()
              .dispatch.navigateAppend({props: {image: first}, selected: 'profileEditAvatar'})
          }
        } catch (error) {
          useConfigState.getState().dispatch.filePickerError(new Error(String(error)))
        }
      }
      ignorePromise(f())
    }
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const f = async () => {
      const {type} = await NetInfo.fetch()
      s.dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type, true)
    }
    ignorePromise(f())
  })

  useConfigState.subscribe((s, old) => {
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

  useConfigState.setState(s => {
    s.dispatch.defer.showShareActionSheet = wrapErrors(
      (filePath: string, message: string, mimeType: string) => {
        const f = async () => {
          await showShareActionSheet({filePath, message, mimeType})
        }
        ignorePromise(f())
      }
    )
  })

  useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'active') {
      // only reload on foreground
      useSettingsContactsState.getState().dispatch.loadContactPermissions()
    }
  })

  // Location
  if (isAndroid) {
    useDarkModeState.subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      androidAppColorSchemeChanged(s.darkModePreference)
    })
  }

  // we call this when we're logged in.
  let calledShareListenersRegistered = false

  useRouterState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    useConfigState.getState().dispatch.defer.persistRoute?.(false, false)

    if (!calledShareListenersRegistered && logState().loggedIn) {
      calledShareListenersRegistered = true
      shareListenersRegistered()
    }
  })

  // Start this immediately instead of waiting so we can do more things in parallel
  ignorePromise(loadStartupDetails())
  initPushListener()

  NetInfo.addEventListener(({type}) => {
    useConfigState.getState().dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type)
  })

  const initAudioModes = () => {
    ignorePromise(setupAudioMode(false))
  }
  initAudioModes()

  if (isAndroid) {
    const daemonState = useDaemonState.getState()
    if (daemonState.handshakeState === 'done' || daemonState.handshakeVersion > 0) {
      configureAndroidCacheDir()
    }
  }

  useConfigState.setState(s => {
    s.dispatch.defer.openAppSettings = wrapErrors(() => {
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
  })

  useRouterState.setState(s => {
    s.dispatch.defer.tabLongPress = wrapErrors((tab: string) => {
      if (tab !== Tabs.peopleTab) return
      const accountRows = useConfigState.getState().configuredAccounts
      const current = useCurrentUserState.getState().username
      const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
      if (row) {
        useConfigState.getState().dispatch.setUserSwitching(true)
        useConfigState.getState().dispatch.login(row.username, '')
      }
    })
  })

  useFSState.setState(s => {
    s.dispatch.defer.pickAndUploadMobile = wrapErrors(
      (type: T.FS.MobilePickType, parentPath: T.FS.Path) => {
        const f = async () => {
          try {
            const result = await launchImageLibraryAsync(type, true, true)
            if (result.canceled) return
            result.assets.map(r =>
              useFSState.getState().dispatch.upload(parentPath, Styles.unnormalizePath(r.uri))
            )
          } catch (e) {
            errorToActionOrThrow(e)
          }
        }
        ignorePromise(f())
      }
    )

    s.dispatch.defer.finishedDownloadWithIntentMobile = wrapErrors(
      (downloadID: string, downloadIntent: T.FS.DownloadIntent, mimeType: string) => {
        const f = async () => {
          const {downloads, dispatch} = useFSState.getState()
          const downloadState = downloads.state.get(downloadID) || FS.emptyDownloadState
          if (downloadState === FS.emptyDownloadState) {
            logger.warn('missing download', downloadID)
            return
          }
          const dismissDownload = dispatch.dismissDownload
          if (downloadState.error) {
            dispatch.redbar(downloadState.error)
            dismissDownload(downloadID)
            return
          }
          const {localPath} = downloadState
          try {
            switch (downloadIntent) {
              case T.FS.DownloadIntent.CameraRoll:
                await saveAttachmentToCameraRoll(localPath, mimeType)
                dismissDownload(downloadID)
                return
              case T.FS.DownloadIntent.Share:
                await showShareActionSheet({filePath: localPath, mimeType})
                dismissDownload(downloadID)
                return
              case T.FS.DownloadIntent.None:
                return
              default:
                return
            }
          } catch (err) {
            errorToActionOrThrow(err)
          }
        }
        ignorePromise(f())
      }
    )
  })

  if (isAndroid) {
    useFSState.setState(s => {
      s.dispatch.defer.afterKbfsDaemonRpcStatusChanged = wrapErrors(() => {
        const f = async () => {
          await T.RPCGen.SimpleFSSimpleFSConfigureDownloadRpcPromise({
            // Android's cache dir is (when I tried) [app]/cache but Go side uses
            // [app]/.cache by default, which can't be used for sharing to other apps.
            cacheDirOverride: fsCacheDir,
            downloadDirOverride: fsDownloadDir,
          })
        }
        ignorePromise(f())
      })
      // needs to be called, TODO could make this better
      s.dispatch.defer.afterKbfsDaemonRpcStatusChanged()

      s.dispatch.defer.finishedRegularDownloadMobile = wrapErrors(
        (downloadID: string, mimeType: string) => {
          const f = async () => {
            // This is fired from a hook and can happen more than once per downloadID.
            // So just deduplicate them here. This is small enough and won't happen
            // constantly, so don't worry about clearing them.
            if (finishedRegularDownloadIDs.has(downloadID)) {
              return
            }
            finishedRegularDownloadIDs.add(downloadID)

            const {downloads} = useFSState.getState()

            const downloadState = downloads.state.get(downloadID) || FS.emptyDownloadState
            const downloadInfo = downloads.info.get(downloadID) || FS.emptyDownloadInfo
            if (downloadState === FS.emptyDownloadState || downloadInfo === FS.emptyDownloadInfo) {
              logger.warn('missing download', downloadID)
              return
            }
            if (downloadState.error) {
              return
            }
            try {
              await androidAddCompleteDownload({
                description: `Keybase downloaded ${downloadInfo.filename}`,
                mime: mimeType,
                path: downloadState.localPath,
                showNotification: true,
                title: downloadInfo.filename,
              })
            } catch {
              logger.warn('Failed to addCompleteDownload')
            }
            // No need to dismiss here as the download wrapper does it for Android.
          }
          ignorePromise(f())
        }
      )
    })
  }

  initSharedSubscriptions()
}

export {onEngineConnected, onEngineDisconnected} from './shared'
