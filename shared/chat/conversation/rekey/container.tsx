import * as C from '@/constants'
import {useCurrentUserState} from '@/stores/current-user'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {navToProfile} from '@/constants/router'
import {useThreadMeta, useThreadRpc} from '../thread-context'

const Container = () => {
  const _you = useCurrentUserState(s => s.username)
  const rekeyers = useThreadMeta(m => m.rekeyers)
  const onBack = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const onEnterPaperkey = () => {
    navigateAppend({name: 'chatEnterPaperkey', params: {}})
  }
  const rpc = useThreadRpc()
  const onRekey = () => {
    C.ignorePromise(rpc.showPendingRekeyStatus())
  }

  const onShowProfile = navToProfile

  return rekeyers.has(_you) ? (
    <YouRekey onEnterPaperkey={onEnterPaperkey} onBack={onBack} onRekey={onRekey} />
  ) : (
    <ParticipantRekey rekeyers={[...rekeyers]} onShowProfile={onShowProfile} onBack={onBack} />
  )
}
export default Container
