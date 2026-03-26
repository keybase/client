import * as C from '@/constants'
import {navigateAppend} from '@/constants/router'
import {settingsPasswordTab} from '@/constants/settings'
import * as T from '@/constants/types'
import {isMobile} from '@/constants/platform'
import * as Tabs from '@/constants/tabs'
import {useLogoutState} from '@/stores/logout'

const navigateToLogoutPassword = () => {
  if (isMobile) {
    navigateAppend(settingsPasswordTab)
  } else {
    navigateAppend(Tabs.settingsTab)
    navigateAppend(settingsPasswordTab)
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
