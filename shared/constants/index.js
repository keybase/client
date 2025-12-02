/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */

Object.defineProperty(exports, 'useActiveState', {get: () => require('./active').useState_})
Object.defineProperty(exports, 'useArchiveState', {get: () => require('./archive').useState_})
Object.defineProperty(exports, 'useAutoResetState', {get: () => require('./autoreset').useState_})
Object.defineProperty(exports, 'AutoReset', {get: () => require('./autoreset')})
Object.defineProperty(exports, 'useBotsState', {get: () => require('./bots').useState_})
Object.defineProperty(exports, 'Bots', {get: () => require('./bots')})
Object.defineProperty(exports, 'useChatState', {get: () => require('./chat2').useState_})
Object.defineProperty(exports, 'Chat', {get: () => require('./chat2')})
Object.defineProperty(exports, 'useConvoState', {get: () => require('./chat2').useConvoState_})
Object.defineProperty(exports, 'chatStores', {get: () => require('./chat2').stores_})
Object.defineProperty(exports, 'ChatProvider', {get: () => require('./chat2').ChatProvider_})
Object.defineProperty(exports, 'getConvoState', {get: () => require('./chat2').getConvoState_})
Object.defineProperty(exports, 'useChatContext', {get: () => require('./chat2').useContext_})
Object.defineProperty(exports, 'useConfigState', {get: () => require('./config').useConfigState_})
Object.defineProperty(exports, 'Config', {get: () => require('./config')})
Object.defineProperty(exports, 'useCryptoState', {get: () => require('./crypto').useState_})
Object.defineProperty(exports, 'Crypto', {get: () => require('./crypto')})
Object.defineProperty(exports, 'useCurrentUserState', {get: () => require('./current-user').useState_})
Object.defineProperty(exports, 'useDaemonState', {get: () => require('./daemon').useState_})
Object.defineProperty(exports, 'maxHandshakeTries', {get: () => require('./daemon').maxHandshakeTries})
Object.defineProperty(exports, 'useDarkModeState', {get: () => require('./darkmode').useState_})
Object.defineProperty(exports, 'useDeepLinksState', {get: () => require('./deeplinks').useState_})
Object.defineProperty(exports, 'DeepLinks', {get: () => require('./deeplinks')})
Object.defineProperty(exports, 'useDevicesState', {get: () => require('./devices').useState_})
Object.defineProperty(exports, 'Devices', {get: () => require('./devices')})
Object.defineProperty(exports, 'useEngineState', {get: () => require('./engine').useState_})
Object.defineProperty(exports, 'useFollowerState', {get: () => require('./followers').useState_})
Object.defineProperty(exports, 'useFSState', {get: () => require('./fs').useState_})
Object.defineProperty(exports, 'FS', {get: () => require('./fs')})
Object.defineProperty(exports, 'useGitState', {get: () => require('./git').useState_})
Object.defineProperty(exports, 'Git', {get: () => require('./git')})
Object.defineProperty(exports, 'Gregor', {get: () => require('./gregor')})
Object.defineProperty(exports, 'useLogoutState', {get: () => require('./logout').useState_})
Object.defineProperty(exports, 'useNotifState', {get: () => require('./notifications').useState_})
Object.defineProperty(exports, 'usePeopleState', {get: () => require('./people').useState_})
Object.defineProperty(exports, 'People', {get: () => require('./people')})
Object.defineProperty(exports, 'usePinentryState', {get: () => require('./pinentry').useState_})
Object.defineProperty(exports, 'useProfileState', {get: () => require('./profile').useState_})
Object.defineProperty(exports, 'Profile', {get: () => require('./profile')})
Object.defineProperty(exports, 'useProvisionState', {get: () => require('./provision').useState_})
Object.defineProperty(exports, 'Provision', {get: () => require('./provision')})
Object.defineProperty(exports, 'usePushState', {get: () => require('./push').useState_})
Object.defineProperty(exports, 'Push', {get: () => require('./push')})
Object.defineProperty(exports, 'useRecoverState', {get: () => require('./recover-password').useState_})
Object.defineProperty(exports, 'RecoverPwd', {get: () => require('./recover-password')})
Object.defineProperty(exports, 'useRouterState', {get: () => require('./router2').useState_})
Object.defineProperty(exports, 'makeScreen', {get: () => require('./router2').makeScreen})
Object.defineProperty(exports, 'Router2', {get: () => require('./router2')})
Object.defineProperty(exports, 'Settings', {get: () => require('./settings')})
Object.defineProperty(exports, 'useSettingsState', {get: () => require('./settings').useState_})
Object.defineProperty(exports, 'useSettingsChatState', {get: () => require('./settings-chat').useState_})
Object.defineProperty(exports, 'SettingsChat', {get: () => require('./settings-chat')})
Object.defineProperty(exports, 'useSettingsContactsState', {get: () => require('./settings-contacts').useState_})
Object.defineProperty(exports, 'importContactsWaitingKey', {get: () => require('./settings-contacts').importContactsWaitingKey})
Object.defineProperty(exports, 'useSettingsEmailState', {get: () => require('./settings-email').useState_})
Object.defineProperty(exports, 'addEmailWaitingKey', {get: () => require('./settings-email').addEmailWaitingKey})
Object.defineProperty(exports, 'useSettingsInvitesState', {get: () => require('./settings-invites').useState_})
Object.defineProperty(exports, 'useSettingsNotifState', {get: () => require('./settings-notifications').useState_})
Object.defineProperty(exports, 'refreshNotificationsWaitingKey', {get: () => require('./settings-notifications').refreshNotificationsWaitingKey})
Object.defineProperty(exports, 'useSettingsPasswordState', {get: () => require('./settings-password').useState_})
Object.defineProperty(exports, 'SettingsPhone', {get: () => require('./settings-phone')})
Object.defineProperty(exports, 'useSettingsPhoneState', {get: () => require('./settings-phone').useState_})
Object.defineProperty(exports, 'useSignupState', {get: () => require('./signup').useState_})
Object.defineProperty(exports, 'Signup', {get: () => require('./signup')})
Object.defineProperty(exports, 'Tabs', {get: () => require('./tabs')})
Object.defineProperty(exports, 'TBProvider', {get: () => require('./team-building').TBProvider_})
Object.defineProperty(exports, 'TBstores', {get: () => require('./team-building').stores_})
Object.defineProperty(exports, 'useTBContext', {get: () => require('./team-building').useContext_})
Object.defineProperty(exports, 'TeamBuilding', {get: () => require('./team-building')})
Object.defineProperty(exports, 'useTeamsState', {get: () => require('./teams').useState_})
Object.defineProperty(exports, 'Teams', {get: () => require('./teams')})
Object.defineProperty(exports, 'useTrackerState', {get: () => require('./tracker2').useState_})
Object.defineProperty(exports, 'Tracker', {get: () => require('./tracker2')})
Object.defineProperty(exports, 'useUFState', {get: () => require('./unlock-folders').useState_})
Object.defineProperty(exports, 'useUsersState', {get: () => require('./users').useState_})
Object.defineProperty(exports, 'Users', {get: () => require('./users')})
Object.defineProperty(exports, 'useWaitingState', {get: () => require('./waiting').useState_})
Object.defineProperty(exports, 'Waiting', {get: () => require('./waiting')})
Object.defineProperty(exports, 'Wallets', {get: () => require('./wallets')})
Object.defineProperty(exports, 'useWalletsState', {get: () => require('./wallets').useState_})
Object.defineProperty(exports, 'useWNState', {get: () => require('./whats-new').useState_})

const logger = require('@/logger').default

exports.initListeners = () => {
  const f = async () => {
    await require('./fs').useState_.getState().dispatch.setupSubscriptions()
    require('./config').useConfigState_.getState().dispatch.setupSubscriptions()
  }
  exports.ignorePromise(f())
}

exports.ignorePromise = (f) => {
  f.then(() => {}).catch(e => {
    logger.error('ignorePromise error', e)
  })
}

exports.timeoutPromise = async (timeMs) =>
  new Promise(resolve => {
    setTimeout(() => resolve(undefined), timeMs)
  })

exports.neverThrowPromiseFunc = async function(f) {
  try {
    return await f()
  } catch {
    return undefined
  }
}

exports.enumKeys = function(enumeration) {
  return Object.keys(enumeration).filter(key => typeof enumeration[key] === 'number')
}

exports.assertNever = (_) => undefined

const {useNavigation} = require('@react-navigation/core')
exports.useNav = () => {
  const na = useNavigation()
  const {canGoBack} = na
  const pop = canGoBack() ? na.goBack : undefined
  const navigate = na.navigate
  return {
    canGoBack,
    navigate,
    pop,
  }
}

