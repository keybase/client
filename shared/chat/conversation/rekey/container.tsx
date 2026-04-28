import * as C from '@/constants'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {navToProfile} from '@/constants/router'
import {useConversationThreadMeta} from '../thread-context'

const Container = () => {
  const _you = useCurrentUserState(s => s.username)
  const rekeyers = useConversationThreadMeta().rekeyers
  const onBack = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const onEnterPaperkey = () => {
    navigateAppend({name: 'chatEnterPaperkey', params: {}})
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
