import * as C from '@/constants'
import {navigateAppend, switchTab} from '@/constants/router'
import {settingsPasswordTab} from '@/constants/settings'
import * as T from '@/constants/types'
import {isMobile} from '@/constants/platform'
import * as Tabs from '@/constants/tabs'
import {useLogoutState} from '@/stores/logout'

const navigateToLogoutPassword = () => {
  if (isMobile) {
    navigateAppend({name: settingsPasswordTab, params: {}})
  } else {
    switchTab(Tabs.settingsTab)
    navigateAppend({name: settingsPasswordTab, params: {}})
  }
}

export const useRequestLogout = () => {
  const start = useLogoutState(s => s.dispatch.start)
  const canLogout = C.useRPC(T.RPCGen.userCanLogoutRpcPromise)

  return () => {
    canLogout(
      [undefined],
      canLogoutRes => {
        if (canLogoutRes.canLogout) {
          start()
        } else {
          navigateToLogoutPassword()
        }
      },
      () => {}
    )
  }
}
