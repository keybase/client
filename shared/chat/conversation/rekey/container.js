// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import ParticipantRekey from './participant-rekey'
import YouRekey from './you-rekey'
import {connect, type TypedState} from '../../../util/container'
import {navigateAppend, navigateUp} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createOpenPopup} from '../../../actions/unlock-folders-gen'

type Props = {
  onBack: () => void,
  onEnterPaperkey: () => void,
  onRekey: () => void,
  onShowProfile: (username: string) => void,
  rekeyers: Array<string>,
  youRekey: boolean,
}

const mapStateToProps = (state: TypedState, {conversationIDKey}) => ({
  _you: state.config.username || '',
  rekeyers: Constants.getMeta(state, conversationIDKey).rekeyers,
})

const mapDispatchToProps = (dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onEnterPaperkey: () => dispatch(navigateAppend(['enterPaperkey'])),
  onRekey: () => dispatch(createOpenPopup()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
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
