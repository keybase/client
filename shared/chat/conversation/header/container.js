// @flow
import * as I from 'immutable'
import * as Constants2 from '../../../constants/chat2'
import * as ChatGen from '../../../actions/chat-gen'
import {ChannelHeader, UsernameHeader} from '.'
import {branch, compose, renderComponent, connect, type TypedState} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {chatTab} from '../../../constants/tabs'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState, {infoPanelOpen}: OwnProps) => {
  const conversationIDKey = Constants2.getSelectedConversation(state)
  const meta = Constants2.getMeta(state, conversationIDKey)
  return {
    _participants: meta.teamname ? I.Set() : meta.participants,
    badgeNumber: state.notifications.getIn(['navBadges', chatTab]),
    canOpenInfoPanel: true, //! Constants.isPendingConversationIDKey(Constants.getSelectedConversation(state) || ''),
    channelName: meta.channelname,
    infoPanelOpen,
    muted: meta.isMuted,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleInfoPanel}: OwnProps) => ({
  onBack,
  onOpenFolder: () => dispatch(ChatGen.createOpenFolder()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onToggleInfoPanel,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumber: stateProps.badgeNumber,
  canOpenInfoPanel: stateProps.canOpenInfoPanel,
  channelName: stateProps.channelName,
  infoPanelOpen: stateProps.infoPanelOpen,
  muted: stateProps.muted,
  onBack: dispatchProps.onBack,
  onOpenFolder: dispatchProps.onOpenFolder,
  onShowProfile: dispatchProps.onShowProfile,
  onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
  participants: stateProps._participants.toArray(),
  smallTeam: stateProps.smallTeam,
  teamName: stateProps.teamName,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !!props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
