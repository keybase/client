import logger from '../../logger'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as FsTypes from '../../constants/types/fs'
import * as SettingsConstants from '../../constants/settings'
import * as ConfigGen from '../config-gen'
import * as ProfileGen from '../profile-gen'
import * as SettingsGen from '../settings-gen'
import * as WaitingGen from '../waiting-gen'
import * as Flow from '../../util/flow'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
// this CANNOT be an import *, totally screws up the packager
import {
  Alert,
  Linking,
  NativeModules,
  ActionSheetIOS,
  CameraRoll,
  PermissionsAndroid,
  Clipboard,
} from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import RNFetchBlob from 'rn-fetch-blob'
import * as PushNotifications from 'react-native-push-notification'
import {Permissions} from 'react-native-unimodules'
import {isIOS, isAndroid} from '../../constants/platform'
import pushSaga, {getStartupDetailsFromInitialPush} from './push.native'
import * as Container from '../../util/container'
import * as Contacts from 'expo-contacts'
import {phoneUtil, PhoneNumberFormat, ValidationResult} from '../../util/phone-numbers'
import {launchImageLibraryAsync} from '../../util/expo-image-picker'
import {pluralize} from '../../util/string'

type NextURI = string

const requestPermissionsToWrite = (): Promise<void> => {
  if (isAndroid) {
    return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
      buttonNegative: 'Cancel',
      buttonNeutral: 'Ask me later',
      buttonPositive: 'OK',
      message: 'Keybase needs access to your storage so we can download a file.',
      title: 'Keybase Storage Permission',
    }).then(permissionStatus =>
      permissionStatus !== 'granted'
        ? Promise.reject(new Error('Unable to acquire storage permissions'))
        : Promise.resolve()
    )
  }
  return Promise.resolve()
}

const requestLocationPermission = (): Promise<void> => {
  if (isAndroid) {
    return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
      message: 'Keybase needs access to your location in order to post it.',
      title: 'Keybase Location Permission',
    }).then(permissionStatus =>
      permissionStatus !== 'granted'
        ? Promise.reject(new Error('Unable to acquire location permissions'))
        : Promise.resolve()
    )
  }
  return Promise.resolve()
}

function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  let goodPath = filePath
  logger.debug('saveAttachment: ', goodPath)
  return requestPermissionsToWrite().then(() => CameraRoll.saveToCameraRoll(goodPath))
}

async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  try {
    await requestPermissionsToWrite()
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await CameraRoll.saveToCameraRoll(fileURL, saveType)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    // This can fail if the user backgrounds too quickly, so throw up a local notification
    // just in case to get their attention.
    PushNotifications.localNotification({
      message: `Failed to save ${saveType} to camera roll`,
    })
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    RNFetchBlob.fs.unlink(filePath)
  }
}

function showShareActionSheetFromURL(options: {
  url?: any | null
  message?: any | null
  mimeType?: string | null
}) {
  if (isIOS) {
    return new Promise((resolve, reject) =>
      ActionSheetIOS.showShareActionSheetWithOptions(options, reject, resolve)
    )
  } else {
    if (!options.url && options.message) {
      return NativeModules.ShareFiles.shareText(options.message, options.mimeType).then(
        () => ({completed: true, method: ''}),
        () => ({completed: false, method: ''})
      )
    }

    return NativeModules.ShareFiles.share(options.url, options.mimeType).then(
      () => ({completed: true, method: ''}),
      () => ({completed: false, method: ''})
    )
  }
}

// Shows the shareactionsheet for a file, and deletes the file afterwards
function showShareActionSheetFromFile(filePath: string): Promise<void> {
  return showShareActionSheetFromURL({url: 'file://' + filePath}).then(() => RNFetchBlob.fs.unlink(filePath))
}

const openAppSettings = () => {
  if (isAndroid) {
    NativeModules.NativeSettings.open()
  } else {
    const settingsURL = 'app-settings:'
    Linking.canOpenURL(settingsURL).then(can => {
      if (can) {
        Linking.openURL(settingsURL)
      } else {
        logger.warn('Unable to open app settings')
      }
    })
  }
}

const getContentTypeFromURL = (
  url: string,
  cb: (arg0: {error?: any; statusCode?: number; contentType?: string; disposition?: string}) => void
) =>
  // For some reason HEAD doesn't work on Android. So just GET one byte.
  // TODO: fix HEAD for Android and get rid of this hack.
  isAndroid
    ? fetch(url, {headers: {Range: 'bytes=0-0'}, method: 'GET'}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          let disposition = ''
          let statusCode = response.status
          if (
            statusCode === 200 ||
            statusCode === 206 ||
            // 416 can happen if the file is empty.
            statusCode === 416
          ) {
            contentType = response.headers.get('Content-Type') || ''
            disposition = response.headers.get('Content-Disposition') || ''
            statusCode = 200 // Treat 200, 206, and 416 as 200.
          }
          cb({contentType, disposition, statusCode})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })
    : fetch(url, {method: 'HEAD'}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          let disposition = ''
          if (response.status === 200) {
            contentType = response.headers.get('Content-Type') || ''
            disposition = response.headers.get('Content-Disposition') || ''
          }
          cb({contentType, disposition, statusCode: response.status})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })

const updateChangedFocus = (_: Container.TypedState, action: ConfigGen.MobileAppStatePayload) => {
  let appFocused: boolean
  let logState: RPCTypes.MobileAppState
  switch (action.payload.nextAppState) {
    case 'active':
      appFocused = true
      logState = RPCTypes.MobileAppState.foreground
      break
    case 'background':
      appFocused = false
      logState = RPCTypes.MobileAppState.background
      break
    case 'inactive':
      appFocused = false
      logState = RPCTypes.MobileAppState.inactive
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action.payload.nextAppState)
      appFocused = false
      logState = RPCTypes.MobileAppState.foreground
  }

  logger.info(`setting app state on service to: ${logState}`)
  return ConfigGen.createChangedFocus({appFocused})
}

const getStartupDetailsFromShare = (): Promise<
  | null
  | {
      localPath: FsTypes.LocalPath
    }
  | {
      text: string
    }
> =>
  isAndroid
    ? NativeModules.IntentHandler.getShareData().then(p => {
        if (!p) return null
        if (p.localPath) {
          return {localPath: FsTypes.stringToLocalPath(p.localPath)}
        }
        if (p.text) {
          return {text: p.text}
        }
        return null
      })
    : Promise.resolve(null)

let _lastPersist = ''
function* persistRoute(state: Container.TypedState, action: ConfigGen.PersistRoutePayload) {
  const path = action.payload.path
  const tab = path[2] // real top is the root of the tab (aka chatRoot) and not the tab itself
  if (!tab) return
  let param = {}
  let routeName = ''
  // top level tab?
  if (tab.routeName === 'tabs.chatTab') {
    const convo = path[path.length - 1]
    // a specific convo?
    if (convo.routeName === 'chatConversation') {
      routeName = convo.routeName
      param = {selectedConversationIDKey: state.chat2.selectedConversation}
    } else {
      // just the inbox
      routeName = tab.routeName
    }
  } else if (Tabs.isValidInitialTabString(tab.routeName)) {
    routeName = tab.routeName
    if (routeName === _lastPersist) {
      // skip rewriting this
      return
    }
  } else {
    return // don't write, keep the last
  }

  const s = JSON.stringify({param, routeName})
  _lastPersist = routeName
  yield Saga.spawn(() =>
    RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s},
    }).catch(() => {})
  )
}

const updateMobileNetState = (_: Container.TypedState, action) => {
  RPCTypes.appStateUpdateMobileNetStateRpcPromise({state: action.payload.type}).catch(err => {
    console.warn('Error sending mobileNetStateUpdate', err)
  })
}

const initOsNetworkStatus = () =>
  NetInfo.getConnectionInfo().then(({type}) =>
    ConfigGen.createOsNetworkStatusChanged({isInit: true, online: type !== 'none', type})
  )

function* setupNetInfoWatcher() {
  const channel = Saga.eventChannel(emitter => {
    NetInfo.addEventListener('connectionChange', ({type}) => emitter(type))
    return () => {}
  }, Saga.buffers.sliding(1))

  while (true) {
    const status = yield Saga.take(channel)
    yield Saga.put(ConfigGen.createOsNetworkStatusChanged({online: status !== 'none', type: status}))
  }
}

function* loadStartupDetails() {
  let startupWasFromPush = false
  let startupConversation = null
  let startupFollowUser = ''
  let startupLink = ''
  let startupTab = null
  let startupSharePath = null

  const routeStateTask = yield Saga._fork(() =>
    RPCTypes.configGuiGetValueRpcPromise({path: 'ui.routeState2'})
      .then(v => v.s || '')
      .catch(() => {})
  )
  const linkTask = yield Saga._fork(Linking.getInitialURL)
  const initialPush = yield Saga._fork(getStartupDetailsFromInitialPush)
  const initialShare = yield Saga._fork(getStartupDetailsFromShare)
  const [routeState, link, push, share] = yield Saga.join(routeStateTask, linkTask, initialPush, initialShare)

  // Clear last value to be extra safe bad things don't hose us forever
  yield Saga._fork(() => {
    RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    })
      .then(() => {})
      .catch(() => {})
  })

  // Top priority, push
  if (push) {
    startupWasFromPush = true
    startupConversation = push.startupConversation
    startupFollowUser = push.startupFollowUser
  } else if (link) {
    // Second priority, deep link
    startupLink = link
  } else if (share) {
    // Third priority, share
    // TODO: handle share.localPath or share.text.
    if (share.localPath) {
      startupSharePath = share.localPath
    }
  } else if (routeState) {
    // Last priority, saved from last session
    try {
      const item = JSON.parse(routeState)
      if (item) {
        startupConversation = item.param && item.param.selectedConversationIDKey
        startupTab = item.routeName
      }
    } catch (_) {
      startupConversation = null
      startupTab = null
    }
  }

  yield Saga.put(
    ConfigGen.createSetStartupDetails({
      startupConversation,
      startupFollowUser,
      startupLink,
      startupSharePath,
      startupTab,
      startupWasFromPush,
    })
  )
}

function* waitForStartupDetails(state: Container.TypedState, action: ConfigGen.DaemonHandshakePayload) {
  // loadStartupDetails finished already
  if (state.config.startupDetailsLoaded) {
    return
  }
  // Else we have to wait for the loadStartupDetails to finish
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'platform.native-waitStartupDetails',
      version: action.payload.version,
    })
  )
  yield Saga.take(ConfigGen.setStartupDetails)
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: false,
      name: 'platform.native-waitStartupDetails',
      version: action.payload.version,
    })
  )
}

const copyToClipboard = (_: Container.TypedState, action: ConfigGen.CopyToClipboardPayload) => {
  Clipboard.setString(action.payload.text)
}

const handleFilePickerError = (_: Container.TypedState, action: ConfigGen.FilePickerErrorPayload) => {
  Alert.alert('Error', action.payload.error.message)
}

const editAvatar = () =>
  launchImageLibraryAsync('photo')
    .then(result =>
      result.cancelled === true
        ? null
        : RouteTreeGen.createNavigateAppend({
            path: [{props: {image: result}, selected: 'profileEditAvatar'}],
          })
    )
    .catch(error => ConfigGen.createFilePickerError({error: new Error(error)}))

const openAppStore = () =>
  Linking.openURL(
    isAndroid
      ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
      : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
  ).catch(() => {})

const expoPermissionStatusMap = {
  [Permissions.PermissionStatus.GRANTED]: 'granted' as const,
  [Permissions.PermissionStatus.DENIED]: 'never_ask_again' as const,
  [Permissions.PermissionStatus.UNDETERMINED]: 'undetermined' as const,
}

const loadContactPermissionFromNative = async () => {
  if (isIOS) {
    return expoPermissionStatusMap[(await Permissions.getAsync(Permissions.CONTACTS)).status]
  }
  return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS))
    ? 'granted'
    : 'undetermined'
}

const loadContactPermissions = async (
  state: Container.TypedState,
  action: SettingsGen.LoadedContactImportEnabledPayload | ConfigGen.MobileAppStatePayload,
  logger: Saga.SagaLogger
) => {
  if (action.type === ConfigGen.mobileAppState && action.payload.nextAppState !== 'active') {
    // only reload on foreground
    return
  }
  const status = await loadContactPermissionFromNative()
  logger.info(`OS status: ${status}`)
  if (
    isAndroid &&
    status === 'undetermined' &&
    ['never_ask_again', 'undetermined'].includes(state.settings.contacts.permissionStatus)
  ) {
    // Workaround PermissionsAndroid.check giving only a boolean. If
    // `requestPermissions` previously told us never_ask_again that is still the
    // status
    return null
  }
  return SettingsGen.createLoadedContactPermissions({status})
}

const askForContactPermissionsAndroid = async () => {
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS)
  // status is 'granted' | 'denied' | 'never_ask_again'
  // map 'denied' -> 'undetermined' since 'undetermined' means we can show the prompt again
  return status === 'denied' ? 'undetermined' : status
}

const askForContactPermissionsIOS = async () => {
  const {status} = await Permissions.askAsync(Permissions.CONTACTS)
  return expoPermissionStatusMap[status]
}

const askForContactPermissions = () => {
  return isAndroid ? askForContactPermissionsAndroid() : askForContactPermissionsIOS()
}

function* requestContactPermissions(
  _: Container.TypedState,
  action: SettingsGen.RequestContactPermissionsPayload
) {
  const {thenToggleImportOn} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: SettingsConstants.importContactsWaitingKey}))
  const result: Saga.RPCPromiseType<typeof askForContactPermissions> = yield askForContactPermissions()
  if (result === 'granted' && thenToggleImportOn) {
    yield Saga.put(SettingsGen.createEditContactImportEnabled({enable: true}))
  }
  yield Saga.sequentially([
    Saga.put(SettingsGen.createLoadedContactPermissions({status: result})),
    Saga.put(WaitingGen.createDecrementWaiting({key: SettingsConstants.importContactsWaitingKey})),
  ])
}

async function manageContactsCache(
  state: Container.TypedState,
  action: SettingsGen.LoadedContactImportEnabledPayload | ConfigGen.MobileAppStatePayload,
  logger: Saga.SagaLogger
) {
  if (action.type === ConfigGen.mobileAppState && action.payload.nextAppState !== 'active') {
    return
  }

  if (state.settings.contacts.importEnabled === false) {
    return RPCTypes.contactsSaveContactListRpcPromise({contacts: []}).then(() =>
      SettingsGen.createSetContactImportedCount({count: null})
    )
  }

  // get permissions if we haven't loaded them for some reason
  let {permissionStatus} = state.settings.contacts
  if (permissionStatus === 'unknown') {
    permissionStatus = await loadContactPermissionFromNative()
  }
  const perm = permissionStatus === 'granted'

  const enabled = state.settings.contacts.importEnabled
  if (!enabled || !perm) {
    if (enabled && !perm) {
      logger.info('contact import enabled but no contact permissions')
    }
    if (enabled === null) {
      logger.info("haven't loaded contact import enabled")
    }
    return
  }

  // feature enabled and permission granted
  const contacts = await Contacts.getContactsAsync()
  let defaultCountryCode: string = ''
  try {
    defaultCountryCode = await NativeModules.Utils.getDefaultCountryCode()
    if (__DEV__ && !defaultCountryCode) {
      // behavior of parsing can be unexpectedly different with no country code.
      // iOS sim + android emu don't supply country codes, so use this one.
      defaultCountryCode = 'us'
    }
  } catch (e) {
    logger.warn(`Error loading default country code: ${e.message}`)
  }
  const mapped = contacts.data.reduce((ret: Array<RPCTypes.Contact>, contact) => {
    const {name, phoneNumbers = [], emails = []} = contact

    const components = phoneNumbers.reduce<RPCTypes.ContactComponent[]>((res, pn) => {
      const formatted = getE164(pn.number || '', pn.countryCode || defaultCountryCode)
      if (formatted) {
        res.push({
          label: pn.label,
          phoneNumber: formatted,
        })
      }
      return res
    }, [])

    components.push(...emails.map(e => ({email: e.email, label: e.label})))
    if (components.length) {
      ret.push({components, name})
    }

    return ret
  }, [])
  logger.info(`Importing ${mapped.length} contacts.`)
  const actions: Array<Container.TypedActions> = []
  try {
    const newlyResolved = await RPCTypes.contactsSaveContactListRpcPromise({contacts: mapped})
    logger.info(`Success`)
    actions.push(
      SettingsGen.createSetContactImportedCount({count: mapped.length}),
      SettingsGen.createLoadedUserCountryCode({code: defaultCountryCode})
    )
    if (newlyResolved && newlyResolved.length) {
      PushNotifications.localNotification({
        message: makeResolvedMessage(newlyResolved),
      })
    }
  } catch (e) {
    logger.error('Error saving contacts list: ', e.message)
  }
  return actions
}

const makeResolvedMessage = (cts: Array<RPCTypes.ProcessedContact>) => {
  if (cts.length === 0) {
    return ''
  }
  switch (cts.length) {
    case 1:
      return `Your contact ${cts[0].contactName} joined Keybase!`
    case 2:
      return `Your contacts ${cts[0].contactName} and ${cts[1].contactName} joined Keybase!`
    default: {
      const lenMinusTwo = cts.length - 2
      return `Your contacts ${cts[0].contactName}, ${cts[1].contactName}, and ${lenMinusTwo} ${pluralize(
        'other',
        lenMinusTwo
      )} joined Keybase!`
    }
  }
}

// Get phone number in e.164, or null if we can't parse it.
const getE164 = (phoneNumber: string, countryCode?: string) => {
  try {
    const parsed = countryCode ? phoneUtil.parse(phoneNumber, countryCode) : phoneUtil.parse(phoneNumber)
    const reason = phoneUtil.isPossibleNumberWithReason(parsed)
    if (reason !== ValidationResult.IS_POSSIBLE) {
      return null
    }
    return phoneUtil.format(parsed, PhoneNumberFormat.E164) as string
  } catch (e) {
    return null
  }
}

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainGenerator<ConfigGen.PersistRoutePayload>(ConfigGen.persistRoute, persistRoute)
  yield* Saga.chainAction2(ConfigGen.mobileAppState, updateChangedFocus)
  yield* Saga.chainAction2(ConfigGen.openAppSettings, openAppSettings)
  yield* Saga.chainAction2(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    waitForStartupDetails
  )
  yield* Saga.chainAction2(ConfigGen.openAppStore, openAppStore)
  yield* Saga.chainAction2(ConfigGen.filePickerError, handleFilePickerError)
  yield* Saga.chainAction2(ProfileGen.editAvatar, editAvatar)
  yield* Saga.chainAction2(ConfigGen.loggedIn, initOsNetworkStatus)
  yield* Saga.chainAction2(ConfigGen.osNetworkStatusChanged, updateMobileNetState)
  yield* Saga.chainAction2(
    [SettingsGen.loadedContactImportEnabled, ConfigGen.mobileAppState],
    loadContactPermissions,
    'loadContactPermissions'
  )
  yield* Saga.chainGenerator<SettingsGen.RequestContactPermissionsPayload>(
    SettingsGen.requestContactPermissions,
    requestContactPermissions,
    'requestContactPermissions'
  )
  yield* Saga.chainAction2(
    [SettingsGen.loadedContactImportEnabled, ConfigGen.mobileAppState],
    manageContactsCache,
    'manageContactsCache'
  )
  // Start this immediately instead of waiting so we can do more things in parallel
  yield Saga.spawn(loadStartupDetails)
  yield Saga.spawn(pushSaga)
  yield Saga.spawn(setupNetInfoWatcher)
}

export {
  showShareActionSheetFromFile,
  showShareActionSheetFromURL,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  getContentTypeFromURL,
  platformConfigSaga,
  requestLocationPermission,
}
