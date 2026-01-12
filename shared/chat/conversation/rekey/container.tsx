import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useProfileState} from '@/stores/profile'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'

const Container = () => {
  const _you = useCurrentUserState(s => s.username)
  const rekeyers = Chat.useChatContext(s => s.meta.rekeyers)
  const onBack = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onEnterPaperkey = () => {
    navigateAppend('chatEnterPaperkey')
  }
  const rekeyShowPendingRekeyStatus = C.useRPC(T.RPCGen.rekeyShowPendingRekeyStatusRpcPromise)
  const onRekey = () => {
    rekeyShowPendingRekeyStatus(
      [],
      () => {},
      () => {}
    )
  }

  const onShowProfile = useProfileState(s => s.dispatch.showUserProfile)

  return rekeyers.has(_you) ? (
    <YouRekey onEnterPaperkey={onEnterPaperkey} onBack={onBack} onRekey={onRekey} />
  ) : (
    <ParticipantRekey rekeyers={[...rekeyers]} onShowProfile={onShowProfile} onBack={onBack} />
  )
}
export default Container
