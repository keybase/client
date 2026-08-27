import * as C from '@/constants'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import * as T from '@/constants/types'

const useRequestAutoInvite = () => {
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySignup)
  const {navigateAppend} = C.Router2

  return (username: string) => {
    if (waiting) {
      return
    }
    const f = async () => {
      if (useConfigState.getState().loggedIn) {
        await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true})
      }
      let inviteCode = ''
      try {
        inviteCode = await T.RPCGen.signupGetInvitationCodeRpcPromise(undefined, C.waitingKeySignup)
      } catch {}
      navigateAppend({name: 'signupEnterUsername', params: {inviteCode, username}})
    }
    ignorePromise(f())
  }
}

export default useRequestAutoInvite
