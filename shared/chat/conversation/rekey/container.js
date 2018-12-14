// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {connect} from '../../../util/container'
import {navigateAppend, navigateUp} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createOpenPopup} from '../../../actions/unlock-folders-gen'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

type Props = {
  onLeftAction: () => void,
  onEnterPaperkey: () => void,
  onRekey: () => void,
  onShowProfile: (username: string) => void,
  rekeyers: Array<string>,
  youRekey: boolean,
}

const mapStateToProps = (state, {conversationIDKey}) => ({
  _you: state.config.username || '',
  rekeyers: Constants.getMeta(state, conversationIDKey).rekeyers,
})

const mapDispatchToProps = dispatch => ({
  onEnterPaperkey: () => dispatch(navigateAppend(['enterPaperkey'])),
  onLeftAction: () => dispatch(navigateUp()),
  onRekey: () => dispatch(createOpenPopup()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onEnterPaperkey: dispatchProps.onEnterPaperkey,
  onLeftAction: dispatchProps.onLeftAction,
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
        onLeftAction={this.props.onLeftAction}
        onRekey={this.props.onRekey}
      />
    ) : (
      <ParticipantRekey
        rekeyers={this.props.rekeyers}
        onShowProfile={this.props.onShowProfile}
        onLeftAction={this.props.onLeftAction}
      />
    )
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Rekey)
