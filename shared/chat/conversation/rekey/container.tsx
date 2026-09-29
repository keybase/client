import * as C from '@/constants'
import {useCurrentUserState} from '@/stores/current-user'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {navToProfile} from '@/constants/router'
import {useConversationThreadActions, useThreadMeta} from '../thread-context'
import {unlessRetired} from '../thread-store'
import {getChatRpc} from '../chat-rpc'

const Container = () => {
  const _you = useCurrentUserState(s => s.username)
  const rekeyers = useThreadMeta(m => m.rekeyers)
  const onBack = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const onEnterPaperkey = () => {
    navigateAppend({name: 'chatEnterPaperkey', params: {}})
  }
  const {isRetired} = useConversationThreadActions()
  // a screen kept through an account switch asks for no rekey
  const {onRekey} = unlessRetired(
    {
      onRekey: () => {
        C.ignorePromise(getChatRpc().showPendingRekeyStatus())
      },
    },
    isRetired
  )

  const onShowProfile = navToProfile

  return rekeyers.has(_you) ? (
    <YouRekey onEnterPaperkey={onEnterPaperkey} onBack={onBack} onRekey={onRekey} />
  ) : (
    <ParticipantRekey rekeyers={[...rekeyers]} onShowProfile={onShowProfile} onBack={onBack} />
  )
}
export default Container
