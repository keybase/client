import * as ConfigConstants from '../../../constants/config'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Constants from '../../../constants/chat2'
import * as ProfileConstants from '../../../constants/profile'
import * as Container from '../../../util/container'
import * as C from '../../../constants'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'

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

export default () => {
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const rekeyers = Constants.useContext(s => s.meta.rekeyers)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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
