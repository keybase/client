import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {ignorePromise, neverThrowPromiseFunc, timeoutPromise} from '@/constants/utils'
import {navUpToScreen, switchTab, getRootState} from '@/constants/router'
import {emitDeepLink} from '@/router-v2/linking'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useLogoutState} from '@/stores/logout'
import {useWaitingState} from '@/stores/waiting'
import {openAppSettings} from '@/util/storeless-actions'
import {type Store, type State} from './push.shared'

export const tokenType = isMobile
  ? (() => {
      const {isDevApplePushToken} = require('@/local-debug') as {isDevApplePushToken: boolean}
      return isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
    })()
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
  pendingPushNotification: undefined,
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
      clearPendingPushNotification: () => {},
      deleteToken: () => {},
      handlePush: () => {},
      initialPermissionsCheck: () => {},
      rejectPermissions: () => {},
      requestPermissions: () => {},
      resetState: Z.defaultReset,
      setPendingPushNotification: () => {},
      setPushToken: () => {},
      showPermissionsPrompt: () => {},
    }
    return {
      ...initialStore,
      dispatch,
    }
  }

  const {
    checkPushPermissions,
    getRegistrationToken,
    iosGetHasShownPushPrompt,
    requestPushPermissions,
    removeAllPendingNotificationRequests,
  } = require('react-native-kb') as {
    checkPushPermissions: () => Promise<boolean>
    getRegistrationToken: () => Promise<string>
    iosGetHasShownPushPrompt: () => Promise<boolean>
    requestPushPermissions: () => Promise<void>
    removeAllPendingNotificationRequests: () => void
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

  const handleLoudMessage = async (notification: T.Push.PushNotification) => {
    if (notification.type !== 'chat.newmessage') {
      return
    }
    if (!notification.userInteraction) {
      logger.warn('[Push] handleLoudMessage: ignore non userInteraction')
      return
    }

    const {conversationIDKey, unboxPayload, membersType} = notification

    const rootState = getRootState()
    const topRoute = rootState?.routes?.at(-1)
    const alreadyOnConv =
      topRoute?.name === 'chatConversation' &&
      (topRoute.params as {conversationIDKey?: string} | undefined)?.conversationIDKey === conversationIDKey
    if (!alreadyOnConv) {
      emitDeepLink(`keybase://convid/${conversationIDKey}`)
    }
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
    clearPendingPushNotification: () => {
      set(s => {
        s.pendingPushNotification = undefined
      })
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
          const forUid = 'forUid' in notification ? notification.forUid : undefined

          if (forUid) {
            const currentUid = useCurrentUserState.getState().uid
            if (forUid !== currentUid) {
              const userInteraction = 'userInteraction' in notification ? notification.userInteraction : false
              if (!userInteraction) {
                logger.info('[Push] notification for different account but no userInteraction, skipping')
                return
              }
              const {configuredAccounts, dispatch: configDispatch} = useConfigState.getState()
              const account = configuredAccounts.find(acc => acc.uid === forUid)
              if (!account) {
                logger.info('[Push] notification forUid not in configured accounts yet, waiting to retry')
                set(s => {
                  s.pendingPushNotification = notification
                })
                return
              }
              if (!account.hasStoredSecret) {
                logger.info('[Push] account has no stored secret, cannot switch')
                return
              }
              if (useConfigState.getState().userSwitching) {
                logger.info('[Push] switch already in progress for this account, skipping duplicate')
                return
              }
              logger.info('[Push] switching to account for notification tap')
              configDispatch.setUserSwitching(true)
              set(s => {
                s.pendingPushNotification = notification
              })
              configDispatch.login(account.username, '')
              return
            }
          }

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
              if (notification.userInteraction) {
                const {username} = notification
                emitDeepLink(`keybase://profile/show/${username}`)
              }
              break
            case 'device.revoked':
            case 'device.new':
              if (notification.userInteraction && useConfigState.getState().loggedIn) {
                switchTab(Tabs.settingsTab)
                navUpToScreen('devicesRoot')
              }
              break
            case 'autoreset':
              break
            case 'chat.extension':
              {
                const {conversationIDKey} = notification
                emitDeepLink(`keybase://convid/${conversationIDKey}`)
              }
              break
            case 'settings.contacts':
              if (useConfigState.getState().loggedIn) {
                emitDeepLink('keybase://people')
              }
              break
          }
        } catch (e) {
          if (__DEV__) {
            console.error(e)
          }
          logger.error('[Push] unhandled', e)
        }
      }
      ignorePromise(f())
    },
    initialPermissionsCheck: () => {
      const f = async () => {
        const hasPermissions = await get().dispatch.checkPermissions()
        if (hasPermissions) {
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
      const pendingPushNotification = useConfigState.getState().userSwitching
        ? get().pendingPushNotification
        : undefined
      set(s => ({
        ...initialStore,
        dispatch: s.dispatch,
        pendingPushNotification,
      }))
    },
    setPendingPushNotification: (notification: T.Push.PushNotification) => {
      set(s => {
        s.pendingPushNotification = notification
      })
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
