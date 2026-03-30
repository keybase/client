import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {navToProfile} from '@/constants/router'

const Container = () => {
  const _you = useCurrentUserState(s => s.username)
  const rekeyers = Chat.useChatContext(s => s.meta.rekeyers)
  const onBack = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
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

  const onShowProfile = navToProfile

  return rekeyers.has(_you) ? (
    <YouRekey onEnterPaperkey={onEnterPaperkey} onBack={onBack} onRekey={onRekey} />
  ) : (
    <ParticipantRekey rekeyers={[...rekeyers]} onShowProfile={onShowProfile} onBack={onBack} />
  )
}
export default Container
