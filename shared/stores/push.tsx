import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {ignorePromise, neverThrowPromiseFunc, timeoutPromise} from '@/constants/utils'
import {emitDeepLink} from '@/router-v2/deep-link-emitter'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useWaitingState} from '@/stores/waiting'
import {openAppSettings} from '@/util/storeless-actions'
type Store = {
  hasPermissions: boolean
  justSignedUp: boolean
  showPushPrompt: boolean
  token: string
}

type State = Store & {
  dispatch: {
    checkPermissions: () => Promise<boolean>
    deleteTokenForLogout: () => Promise<void>
    initialPermissionsCheck: () => void
    rejectPermissions: () => void
    requestPermissions: () => void
    resetState: () => void
    setPushToken: (token: string) => void
    showPermissionsPrompt: (p: {show?: boolean; persistSkip?: boolean; justSignedUp?: boolean}) => void
  }
}
import {isDevApplePushToken} from '@/local-debug'
import {checkPushPermissions, getRegistrationToken, iosGetHasShownPushPrompt, requestPushPermissions} from 'react-native-kb'

export const tokenType = isMobile
  ? isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
  : ''

const desktopInitialStore: Store = {
  hasPermissions: false,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

const mobileInitialStore: Store = {
  hasPermissions: true,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

const initialStore: Store = isMobile ? mobileInitialStore : desktopInitialStore

export const usePushState = Z.createZustand<State>('push', (set, get) => {
  if (!isMobile) {
    const dispatch: State['dispatch'] = {
      checkPermissions: async () => {
        return Promise.resolve(false)
      },
      deleteTokenForLogout: async () => {},
      initialPermissionsCheck: () => {},
      rejectPermissions: () => {},
      requestPermissions: () => {},
      resetState: Z.defaultReset,
      setPushToken: () => {},
      showPermissionsPrompt: () => {},
    }
    return {
      ...initialStore,
      dispatch,
    }
  }

  const monsterStorageKey = 'shownMonsterPushPrompt'

  const neverShowMonsterAgain = async () => {
    await T.RPCGen.configGuiSetValueRpcPromise({
      path: `ui.${monsterStorageKey}`,
      value: {b: true, isNull: false},
    })
  }

  const askNativeIfSystemPushPromptHasBeenShown = async () =>
    isIOS ? await iosGetHasShownPushPrompt() : Promise.resolve(false)

  const checkPermissionsFromNative = async () => {
    const on = await checkPushPermissions()
    return {alert: on, badge: on, sound: on}
  }

  const requestPermissionsFromNative = async () => {
    await requestPushPermissions()
  }

  const fetchIOSTokenIfNeeded = () => {
    if (isIOS && !get().token) {
      getRegistrationToken()
        .then(token => get().dispatch.setPushToken(token))
        .catch(() => {})
    }
  }

  const dispatch: State['dispatch'] = {
    checkPermissions: async () => {
      const permissions = await checkPermissionsFromNative()
      if (permissions.alert || permissions.badge) {
        if (!get().hasPermissions) {
          logger.info('[PushCheck] enabled: getting token')
          set(s => {
            s.hasPermissions = true
          })
          await requestPermissionsFromNative()
        } else {
          logger.info('[PushCheck] enabled already')
        }
        fetchIOSTokenIfNeeded()
        return true
      } else {
        logger.info('[PushCheck] disabled')
        set(s => {
          s.hasPermissions = false
        })
        return false
      }
    },
    deleteTokenForLogout: async () => {
      try {
        const deviceID = useCurrentUserState.getState().deviceID
        if (!deviceID) {
          logger.info('[PushToken] no device id')
          return
        }
        await T.RPCGen.apiserverDeleteRpcPromise({
          args: [
            {key: 'device_id', value: deviceID},
            {key: 'token_type', value: tokenType},
          ],
          endpoint: 'device/push_token',
        })
        logger.info('[PushToken] deleted from server')
      } catch (e) {
        logger.error('[PushToken] delete failed', e)
      }
    },
    initialPermissionsCheck: () => {
      const f = async () => {
        const hasPermissions = await get().dispatch.checkPermissions()
        if (hasPermissions) {
          // Get the token
          await requestPermissionsFromNative()
          fetchIOSTokenIfNeeded()
        } else {
          const [shownNativePushPrompt, shownMonsterPushPrompt] = await Promise.all([
            neverThrowPromiseFunc(askNativeIfSystemPushPromptHasBeenShown),
            neverThrowPromiseFunc(async () => {
              const v = await T.RPCGen.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
              return !!v.b
            }),
          ])
          logger.info(
            '[PushInitialCheck] shownNativePushPrompt:',
            shownNativePushPrompt,
            'shownMonsterPushPrompt:',
            shownMonsterPushPrompt
          )
          if (!shownNativePushPrompt && !shownMonsterPushPrompt) {
            logger.info('[PushInitialCheck] no permissions, never shown prompt, now show prompt')
            get().dispatch.showPermissionsPrompt({show: true})
          }
        }
      }
      ignorePromise(f())
    },
    rejectPermissions: () => {
      set(s => {
        s.hasPermissions = false
        s.showPushPrompt = false
      })
      ignorePromise(neverShowMonsterAgain())
    },
    requestPermissions: () => {
      const f = async () => {
        if (isIOS) {
          const shownPushPrompt = await askNativeIfSystemPushPromptHasBeenShown()
          if (shownPushPrompt) {
            // we've already shown the prompt, take them to settings
            openAppSettings()
            get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
            return
          }
        }
        const {increment, decrement} = useWaitingState.getState().dispatch
        try {
          openAppSettings()
          increment(S.waitingKeyPushPermissionsRequesting)
          await requestPermissionsFromNative()
          const permissions = await checkPermissionsFromNative()
          if (permissions.alert || permissions.badge) {
            logger.info('[PushRequesting] enabled')
            set(s => {
              s.hasPermissions = true
            })
          } else {
            logger.info('[PushRequesting] disabled')
            set(s => {
              s.hasPermissions = false
            })
          }
        } finally {
          decrement(S.waitingKeyPushPermissionsRequesting)
          get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({...initialStore, dispatch: s.dispatch}))
    },
    setPushToken: (token: string) => {
      set(s => {
        s.token = token
      })

      const uploadPushToken = async () => {
        const {deviceID, username} = useCurrentUserState.getState()
        if (!username || !deviceID) {
          logger.info('[PushToken] skipping upload, no user state yet')
          return
        }
        try {
          await T.RPCGen.apiserverPostRpcPromise({
            args: [
              {key: 'push_token', value: token},
              {key: 'device_id', value: deviceID},
              {key: 'token_type', value: tokenType},
            ],
            endpoint: 'device/push_token',
          })
          logger.info('[PushToken] Uploaded to server')
        } catch (e) {
          logger.error("[PushToken] Couldn't save a push token", e)
        }
      }
      if (token) {
        ignorePromise(uploadPushToken())
      }
    },
    showPermissionsPrompt: p => {
      set(s => {
        if (p.show !== undefined) {
          s.showPushPrompt = p.show
        }
        s.justSignedUp = !!p.justSignedUp
      })
      const monsterPrompt = async () => {
        if (
          p.show &&
          useConfigState.getState().loggedIn &&
          useDaemonState.getState().handshakeState === 'done' &&
          !get().justSignedUp &&
          !get().hasPermissions
        ) {
          logger.info('[ShowMonsterPushPrompt] Entered through the late permissions checker scenario')
          await timeoutPromise(100)
          emitDeepLink('keybase://settingsPushPrompt')
        }
      }
      ignorePromise(monsterPrompt())

      if (!get().showPushPrompt && p.persistSkip) {
        ignorePromise(neverShowMonsterAgain())
      }
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
