import * as C from '@/constants'
import {ignorePromise} from '@/constants/utils'
import {navigateAppend, switchTab} from '@/constants/router'
import {settingsPasswordTab} from '@/constants/settings'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {usePushState} from '@/stores/push'

const navigateToLogoutPassword = () => {
  if (isMobile) {
    navigateAppend({name: settingsPasswordTab, params: {}})
  } else {
    switchTab(Tabs.settingsTab)
    navigateAppend({name: settingsPasswordTab, params: {}})
  }
}

const logout = async () => {
  // Unregister the push token first; the API call needs the still-logged-in session
  await usePushState.getState().dispatch.deleteTokenForLogout()
  try {
    await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: false})
  } catch {}
}

export const useRequestLogout = () => {
  const canLogout = C.useRPC(T.RPCGen.userCanLogoutRpcPromise)

  return () => {
    canLogout(
      [undefined],
      canLogoutRes => {
        if (canLogoutRes.canLogout) {
          ignorePromise(logout())
        } else {
          navigateToLogoutPassword()
        }
      },
      () => {}
    )
  }
}
