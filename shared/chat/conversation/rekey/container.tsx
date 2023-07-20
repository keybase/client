import * as ConfigConstants from '../../../constants/config'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Constants from '../../../constants/chat2'
import * as ProfileConstants from '../../../constants/profile'
import * as Container from '../../../util/container'
import * as RouterConstants from '../../../constants/router2'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import type * as Types from '../../../constants/types/chat2'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

type Props = {
  onBack: () => void
  onEnterPaperkey: () => void
  onRekey: () => void
  onShowProfile: (username: string) => void
  rekeyers: Array<string>
  youRekey: boolean
}

const Rekey = (props: Props) =>
  props.youRekey ? (
    <YouRekey onEnterPaperkey={props.onEnterPaperkey} onBack={props.onBack} onRekey={props.onRekey} />
  ) : (
    <ParticipantRekey rekeyers={props.rekeyers} onShowProfile={props.onShowProfile} onBack={props.onBack} />
  )

export default (ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const rekeyers = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).rekeyers)
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onBack = () => {
    navigateUp()
  }
  const onEnterPaperkey = () => {
    navigateAppend('chatEnterPaperkey')
  }

  const rekeyShowPendingRekeyStatus = Container.useRPC(RPCTypes.rekeyShowPendingRekeyStatusRpcPromise)

  const onRekey = () => {
    rekeyShowPendingRekeyStatus(
      [],
      () => {},
      () => {}
    )
  }

  const onShowProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const props = {
    onBack,
    onEnterPaperkey,
    onRekey,
    onShowProfile,
    rekeyers: [...rekeyers],
    youRekey: rekeyers.has(_you),
  }
  return <Rekey {...props} />
}
