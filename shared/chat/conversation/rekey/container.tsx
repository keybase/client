import * as ConfigConstants from '../../../constants/config'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import type * as Types from '../../../constants/types/chat2'
import {createOpenPopup} from '../../../actions/unlock-folders-gen'
import {createShowUserProfile} from '../../../actions/profile-gen'

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
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onEnterPaperkey = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['chatEnterPaperkey']}))
  }
  const onRekey = () => {
    dispatch(createOpenPopup())
  }
  const onShowProfile = (username: string) => {
    dispatch(createShowUserProfile({username}))
  }
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
