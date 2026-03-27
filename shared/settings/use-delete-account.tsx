import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'

export const useDeleteAccount = () => {
  const username = useCurrentUserState(s => s.username)
  const setJustDeletedSelf = useConfigState(s => s.dispatch.setJustDeletedSelf)
  const {clearModals, navigateAppend} = C.useRouterState(
    C.useShallow(s => ({
      clearModals: s.dispatch.clearModals,
      navigateAppend: s.dispatch.navigateAppend,
    }))
  )
  const deleteAccountRPC = C.useRPC(T.RPCGen.loginAccountDeleteRpcPromise)

  const deleteAccountForever = (passphrase?: string) => {
    if (!username) {
      throw new Error('Unable to delete account: no username set')
    }

    if (C.androidIsTestDevice) {
      return
    }

    deleteAccountRPC(
      [{passphrase}, C.waitingKeySettingsGeneric],
      () => {
        setJustDeletedSelf(username)
        clearModals()
        navigateAppend(C.Tabs.loginTab)
      },
      error => {
        logger.warn('Error deleting account', error)
      }
    )
  }

  return deleteAccountForever
}
