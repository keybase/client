import * as C from '.'
import * as Tabs from './tabs'
import * as Z from '@/util/zustand'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '@/logger'
import * as T from './types'
import {isDevApplePushToken} from '@/local-debug'
import {isIOS} from './platform'
import {
  iosGetHasShownPushPrompt,
  androidRequestPushPermissions,
  androidCheckPushPermissions,
} from 'react-native-kb'
import {type Store, type State} from './push'

export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'
export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'

const initialStore: Store = {
  hasPermissions: true,
  justSignedUp: false,
  showPushPrompt: false,
  token: '',
}

const monsterStorageKey = 'shownMonsterPushPrompt'
export const _useState = Z.createZustand<State>((set, get) => {
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
      if (isIOS) {
        PushNotificationIOS.checkPermissions(perms => resolve(perms))
      } else {
        androidCheckPushPermissions()
          .then(on => resolve({alert: on, badge: on, sound: on}))
          .catch(() => reject(new Error('')))
      }
    })

  type ReqType = Promise<{
    alert: boolean
    badge: boolean
    sound: boolean
  }>
  const requestPermissionsFromNative: () => ReqType = async () => {
    if (isIOS) {
      const perm = await (PushNotificationIOS.requestPermissions() as ReqType)
      return perm
    } else {
      const on = await androidRequestPushPermissions()
      const perm = {alert: on, badge: on, sound: on}
      return perm
    }
  }

  const handleLoudMessage = async (notification: T.Push.PushNotification) => {
    if (notification.type !== 'chat.newmessage') {
      return
    }
    // We only care if the user clicked while in session
    if (!notification.userInteraction) {
      logger.warn('push ignore non userInteraction')
      return
    }

    const {conversationIDKey, unboxPayload, membersType} = notification

    logger.warn('push selecting ', conversationIDKey)
    C.getConvoState(conversationIDKey).dispatch.navigateToThread('push', undefined, unboxPayload)
    if (unboxPayload && membersType && !isIOS) {
      logger.info('[Push] unboxing message')
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
        return true
      } else {
        logger.info('[PushCheck] disabled')
        set(s => {
          s.hasPermissions = false
        })
        return false
      }
    },
    deleteToken: version => {
      const f = async () => {
        const waitKey = 'push:deleteToken'
        C.useLogoutState.getState().dispatch.wait(waitKey, version, true)
        try {
          const deviceID = C.useCurrentUserState.getState().deviceID
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
          C.useLogoutState.getState().dispatch.wait(waitKey, version, false)
        }
      }
      C.ignorePromise(f())
    },
    handlePush: notification => {
      const f = async () => {
        // on iOS the go side handles a lot of push details
        try {
          logger.info('[Push]: ' + notification.type || 'unknown')

          switch (notification.type) {
            case 'chat.readmessage':
              logger.info('[Push] read message')
              if (notification.badges === 0) {
                isIOS && PushNotificationIOS.removeAllPendingNotificationRequests()
              }
              break
            case 'chat.newmessageSilent_2':
              // entirely handled by go on ios and in onNotification on Android
              break
            case 'chat.newmessage':
              await handleLoudMessage(notification)
              break
            case 'follow':
              // We only care if the user clicked while in session
              if (notification.userInteraction) {
                const {username} = notification
                logger.info('[Push] follower: ', username)
                C.useProfileState.getState().dispatch.showUserProfile(username)
              }
              break
            case 'chat.extension':
              {
                const {conversationIDKey} = notification
                C.getConvoState(conversationIDKey).dispatch.navigateToThread('extension')
              }
              break
            case 'settings.contacts':
              if (C.useConfigState.getState().loggedIn) {
                C.useRouterState.getState().dispatch.switchTab(Tabs.peopleTab)
                C.useRouterState.getState().dispatch.navUpToScreen('peopleRoot')
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
      C.ignorePromise(f())
    },
    initialPermissionsCheck: () => {
      const f = async () => {
        const hasPermissions = await get().dispatch.checkPermissions()
        if (hasPermissions) {
          // Get the token
          await requestPermissionsFromNative()
        } else {
          const shownNativePushPromptTask = askNativeIfSystemPushPromptHasBeenShown
          const shownMonsterPushPromptTask = async () => {
            const v = await T.RPCGen.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
            return !!v.b
          }
          const [shownNativePushPrompt, shownMonsterPushPrompt] = await Promise.all([
            C.neverThrowPromiseFunc(shownNativePushPromptTask),
            C.neverThrowPromiseFunc(shownMonsterPushPromptTask),
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
      C.ignorePromise(f())
    },
    rejectPermissions: () => {
      set(s => {
        s.hasPermissions = false
        s.showPushPrompt = false
      })
      C.ignorePromise(neverShowMonsterAgain())
    },
    requestPermissions: () => {
      const f = async () => {
        if (isIOS) {
          const shownPushPrompt = await askNativeIfSystemPushPromptHasBeenShown()
          if (shownPushPrompt) {
            // we've already shown the prompt, take them to settings
            C.useConfigState.getState().dispatch.dynamic.openAppSettings?.()
            get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
            return
          }
        }
        try {
          C.useConfigState.getState().dispatch.dynamic.openAppSettings?.()
          const {increment} = C.useWaitingState.getState().dispatch
          increment(permissionsRequestingWaitingKey)
          logger.info('[PushRequesting] asking native')
          await requestPermissionsFromNative()
          const permissions = await checkPermissionsFromNative()
          logger.info('[PushRequesting] after prompt:', permissions)
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
          const {decrement} = C.useWaitingState.getState().dispatch
          decrement(permissionsRequestingWaitingKey)
          get().dispatch.showPermissionsPrompt({persistSkip: true, show: false})
        }
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    setPushToken: (token: string) => {
      set(s => {
        s.token = token
      })

      const uploadPushToken = async () => {
        const {deviceID, username} = C.useCurrentUserState.getState()
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
        C.ignorePromise(uploadPushToken())
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
          C.useConfigState.getState().loggedIn &&
          C.useDaemonState.getState().handshakeState === 'done' &&
          !get().justSignedUp &&
          !get().hasPermissions
        ) {
          logger.info('[ShowMonsterPushPrompt] Entered through the late permissions checker scenario')
          await C.timeoutPromise(100)
          C.useRouterState.getState().dispatch.switchTab(Tabs.peopleTab)
          C.useRouterState.getState().dispatch.navigateAppend('settingsPushPrompt')
        }
      }
      C.ignorePromise(monsterPrompt())

      if (!get().showPushPrompt && p.persistSkip) {
        C.ignorePromise(neverShowMonsterAgain())
      }
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
