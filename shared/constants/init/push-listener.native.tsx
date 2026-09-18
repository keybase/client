import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import {emitDeepLink} from '@/router-v2/deep-link-emitter'
import {subscribeIntentAccountSwitch} from '@/router-v2/account-link-switch'
import {
  getRegistrationToken,
  setApplicationIconBadgeNumber,
  onPushToken,
  onShareData,
  removeAllPendingNotificationRequests,
} from 'react-native-kb'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {usePushState} from '@/stores/push'
import {useShellState} from '@/stores/shell'

export const initPushListener = () => {
  const unsubs: Array<() => void> = []
  // Permissions
  unsubs.push(
    useShellState.subscribe((s, old) => {
      if (s.mobileAppState === old.mobileAppState) return
      // Only recheck on foreground, not background
      if (s.mobileAppState !== 'active') {
        logger.info('[PushCheck] skip on backgrounding')
        return
      }
      logger.debug(`[PushCheck] checking on foreground`)
      usePushState
        .getState()
        .dispatch.checkPermissions()
        .then(() => {})
        .catch(() => {})
    })
  )

  let lastCount = -1
  unsubs.push(
    useConfigState.subscribe((s, old) => {
      if (s.badgeState === old.badgeState) return
      if (!s.badgeState) return
      const count = s.badgeState.bigTeamBadgeCount + s.badgeState.smallTeamBadgeCount
      setApplicationIconBadgeNumber(count)
      // Only do this native call if the count actually changed, not over and over if its zero
      if (count === 0 && lastCount !== 0) {
        removeAllPendingNotificationRequests()
      }
      lastCount = count
    })
  )

  // Retry token upload when user state becomes available.
  // The FCM token often arrives before username/deviceID are loaded,
  // so the initial upload silently bails. This retries once user state is ready.
  unsubs.push(
    useCurrentUserState.subscribe((s, old) => {
      if (s.username === old.username && s.deviceID === old.deviceID) return
      const token = usePushState.getState().token
      if (token && s.username && s.deviceID) {
        usePushState.getState().dispatch.setPushToken(token)
      }
    })
  )

  usePushState.getState().dispatch.initialPermissionsCheck()

  // Taps are taken from the service in constants/init/shared; this only has to be watching the
  // intent store by the time one lands, and its own first check covers anything already queued.
  unsubs.push(subscribeIntentAccountSwitch())

  try {
    // Token and share listeners
    if (isIOS) {
      const tokenSub = onPushToken(token => {
        logger.debug('[PushToken] received token via onPushToken event: ', token)
        usePushState.getState().dispatch.setPushToken(token)
      })
      unsubs.push(() => tokenSub.remove())
    }

    if (isAndroid) {
      const shareSub = onShareData(evt => {
        const {setAndroidShare} = useConfigState.getState().dispatch

        const text = evt.text
        const urls = evt.localPaths

        if (urls) {
          setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls})
        } else if (text) {
          setAndroidShare({text, type: T.RPCGen.IncomingShareType.text})
        } else {
          return
        }
        emitDeepLink('keybase://incoming-share')
      })
      unsubs.push(() => shareSub.remove())
      // shareListenersRegistered() is deliberately NOT called here: the init/index.tsx
      // router subscriber controls when native flushes pending share intents.
    }
  } catch (e) {
    logger.error('[Push] failed to set up listeners: ', e)
  }

  // Get token after listener is set up (may fail if not ready yet, but listener is already active)
  const fetchToken = async () => {
    try {
      const pushToken = await getRegistrationToken()
      logger.debug('[PushToken] received new token: ', pushToken)
      usePushState.getState().dispatch.setPushToken(pushToken)
    } catch (e) {
      logger.warn('[PushToken] failed to get token (will retry later): ', e)
      // Token will be retrieved later when permissions are checked
    }
  }
  ignorePromise(fetchToken())

  return unsubs
}
