import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
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

const mapStateToProps = (state, {conversationIDKey}) => ({
  _you: state.config.username || '',
  rekeyers: Constants.getMeta(state, conversationIDKey).rekeyers,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onEnterPaperkey: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['enterPaperkey']})),
  onRekey: () => dispatch(createOpenPopup()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  onBack: dispatchProps.onBack,
  onEnterPaperkey: dispatchProps.onEnterPaperkey,
  onRekey: dispatchProps.onRekey,
  onShowProfile: dispatchProps.onShowProfile,
  rekeyers: stateProps.rekeyers.toArray(),
  youRekey: stateProps.rekeyers.has(stateProps._you),
})

class Rekey extends React.PureComponent<Props> {
  render() {
    return this.props.youRekey ? (
      <YouRekey
        onEnterPaperkey={this.props.onEnterPaperkey}
        onBack={this.props.onBack}
        onRekey={this.props.onRekey}
      />
    ) : (
      <ParticipantRekey
        rekeyers={this.props.rekeyers}
        onShowProfile={this.props.onShowProfile}
        onBack={this.props.onBack}
      />
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Rekey)
