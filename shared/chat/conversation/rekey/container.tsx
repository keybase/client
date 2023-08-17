import * as C from '../../../constants'
import * as T from '../../../constants/types'
import * as Container from '../../../util/container'
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
  const _you = C.useCurrentUserState(s => s.username)
  const rekeyers = C.useChatContext(s => s.meta.rekeyers)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBack = () => {
    navigateUp()
  }
  const onEnterPaperkey = () => {
    navigateAppend('chatEnterPaperkey')
  }

  const rekeyShowPendingRekeyStatus = Container.useRPC(T.RPCGen.rekeyShowPendingRekeyStatusRpcPromise)

  const onRekey = () => {
    rekeyShowPendingRekeyStatus(
      [],
      () => {},
      () => {}
    )
  }

  const onShowProfile = C.useProfileState(s => s.dispatch.showUserProfile)
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
