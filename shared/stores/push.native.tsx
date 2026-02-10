import * as Tabs from '@/constants/tabs'
import * as S from '@/constants/strings'
import {ignorePromise, neverThrowPromiseFunc, timeoutPromise} from '@/constants/utils'
import {navigateAppend, navUpToScreen, switchTab} from '@/constants/router2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useLogoutState} from '@/stores/logout'
import {useWaitingState} from '@/stores/waiting'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import * as T from '@/constants/types'
import {isDevApplePushToken} from '@/local-debug'
import {isIOS} from '@/constants/platform'
import {
  checkPushPermissions,
  getRegistrationToken,
  iosGetHasShownPushPrompt,
  requestPushPermissions,
  removeAllPendingNotificationRequests,
} from 'react-native-kb'
import {type Store, type State} from '@/stores/push'

export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'

const initialStore: Store = {
  hasPermissions: true,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

const monsterStorageKey = 'shownMonsterPushPrompt'
export const usePushState = Z.createZustand<State>((set, get) => {
  const neverShowMonsterAgain = async () => {
    await T.RPCGen.configGuiSetValueRpcPromise({
      path: `ui.${monsterStorageKey}`,
      value: {b: true, isNull: false},
    })
  }

  const askNativeIfSystemPushPromptHasBeenShown = async () =>
    isIOS ? await iosGetHasShownPushPrompt() : Promise.resolve(false)

  const checkPermissionsFromNative = async () =>
    new Promise<{alert?: boolean; badge?: boolean; sound?: boolean}>((resolve, reject) => {
      checkPushPermissions()
        .then(on => {
          resolve({alert: on, badge: on, sound: on})
        })
        .catch(() => reject(new Error('')))
    })

  type ReqType = Promise<{
    alert: boolean
    badge: boolean
    sound: boolean
  }>
  const requestPermissionsFromNative: () => ReqType = async () => {
    const on = await requestPushPermissions()
    return {alert: on, badge: on, sound: on}
  }

  const handleLoudMessage = async (notification: T.Push.PushNotification) => {
    if (notification.type !== 'chat.newmessage') {
      return
    }
    // We only care if the user clicked while in session
    if (!notification.userInteraction) {
      logger.warn('[Push] handleLoudMessage: ignore non userInteraction')
      return
    }

    const {conversationIDKey, unboxPayload, membersType} = notification

    get().dispatch.defer.onNavigateToThread?.(conversationIDKey, 'push', unboxPayload)
    if (unboxPayload && membersType && !isIOS) {
      try {
        await T.RPCChat.localUnboxMobilePushNotificationRpcPromise({
          convID: conversationIDKey,
          membersType,
          payload: unboxPayload,
          shouldAck: false,
        })
      } catch {
        logger.info('[Push] failed to unbox message from payload')
      }
    }
  }

  const dispatch: State['dispatch'] = {
    // Call when we foreground and on app start, action is undefined on app start. Returns if you have permissions
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
        if (isIOS && !get().token) {
          getRegistrationToken()
            .then(token => get().dispatch.setPushToken(token))
            .catch(() => {})
        }
        return true
      } else {
        logger.info('[PushCheck] disabled')
        set(s => {
          s.hasPermissions = false
        })
        return false
      }
    },
    defer: {
      onGetDaemonHandshakeState: () => {
        throw new Error('onGetDaemonHandshakeState not implemented')
      },
      onNavigateToThread: () => {
        throw new Error('onNavigateToThread not implemented')
      },
      onShowUserProfile: () => {
        throw new Error('onShowUserProfile not implemented')
      },
    },
    deleteToken: version => {
      const f = async () => {
        const waitKey = 'push:deleteToken'
        useLogoutState.getState().dispatch.wait(waitKey, version, true)
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
        } finally {
          useLogoutState.getState().dispatch.wait(waitKey, version, false)
        }
      }
      ignorePromise(f())
    },
    handlePush: notification => {
      const f = async () => {
        try {
          switch (notification.type) {
            case 'chat.readmessage':
              if (notification.badges === 0) {
                removeAllPendingNotificationRequests()
              }
              break
            case 'chat.newmessageSilent_2':
              break
            case 'chat.newmessage':
              await handleLoudMessage(notification)
              break
            case 'follow':
              // We only care if the user clicked while in session
              if (notification.userInteraction) {
                const {username} = notification
                get().dispatch.defer.onShowUserProfile?.(username)
              }
              break
            case 'chat.extension':
              {
                const {conversationIDKey} = notification
                get().dispatch.defer.onNavigateToThread?.(conversationIDKey, 'extension')
              }
              break
            case 'settings.contacts':
              if (useConfigState.getState().loggedIn) {
                switchTab(Tabs.peopleTab)
                navUpToScreen('peopleRoot')
              }
              break
          }
        } catch (e) {
          if (__DEV__) {
            console.error(e)
          }

          logger.error('[Push] unhandled!!')
        }
      }
      ignorePromise(f())
    },
    initialPermissionsCheck: () => {
      const f = async () => {
        const hasPermissions = await get().dispatch.checkPermissions()
        if (hasPermissions) {
          // Get the token
          await requestPermissionsFromNative()
          if (isIOS && !get().token) {
            getRegistrationToken()
              .then(token => get().dispatch.setPushToken(token))
              .catch(() => {})
          }
        } else {
          const shownNativePushPromptTask = askNativeIfSystemPushPromptHasBeenShown
          const shownMonsterPushPromptTask = async () => {
            const v = await T.RPCGen.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
            return !!v.b
          }
          const [shownNativePushPrompt, shownMonsterPushPrompt] = await Promise.all([
            neverThrowPromiseFunc(shownNativePushPromptTask),
            neverThrowPromiseFunc(shownMonsterPushPromptTask),
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
            useConfigState.getState().dispatch.defer.openAppSettings?.()
            get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
            return
          }
        }
        try {
          useConfigState.getState().dispatch.defer.openAppSettings?.()
          const {increment} = useWaitingState.getState().dispatch
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
          const {decrement} = useWaitingState.getState().dispatch
          decrement(S.waitingKeyPushPermissionsRequesting)
          get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
        }
      }
      ignorePromise(f())
    },
    resetState: 'default',
    setPushToken: (token: string) => {
      set(s => {
        s.token = token
      })

      const uploadPushToken = async () => {
        const {deviceID, username} = useCurrentUserState.getState()
        if (!username || !deviceID) {
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
        // Monster push prompt
        // We've just started up, we don't have the permissions, we're logged in and we
        // haven't just signed up. This handles the scenario where the push notifications
        // permissions checker finishes after the routeToInitialScreen is done.
        if (
          p.show &&
          useConfigState.getState().loggedIn &&
          get().dispatch.defer.onGetDaemonHandshakeState?.() === 'done' &&
          !get().justSignedUp &&
          !get().hasPermissions
        ) {
          logger.info('[ShowMonsterPushPrompt] Entered through the late permissions checker scenario')
          await timeoutPromise(100)
          switchTab(Tabs.peopleTab)
          navigateAppend('settingsPushPrompt')
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
