import type * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createOpenPopup} from '../../../actions/unlock-folders-gen'

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

export default connect(
  (state, {conversationIDKey}: OwnProps) => ({
    _you: state.config.username,
    rekeyers: Constants.getMeta(state, conversationIDKey).rekeyers,
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onEnterPaperkey: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['chatEnterPaperkey']})),
    onRekey: () => dispatch(createOpenPopup()),
    onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onBack: dispatchProps.onBack,
    onEnterPaperkey: dispatchProps.onEnterPaperkey,
    onRekey: dispatchProps.onRekey,
    onShowProfile: dispatchProps.onShowProfile,
    rekeyers: [...stateProps.rekeyers],
    youRekey: stateProps.rekeyers.has(stateProps._you),
  })
)(Rekey)
