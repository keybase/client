// @flow
import * as Constants2 from '../../../constants/chat2'
import * as ChatGen from '../../../actions/chat-gen'
import {ChannelHeader, UsernameHeader} from '.'
import {branch, compose, renderComponent, connect, type TypedState} from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {chatTab} from '../../../constants/tabs'
import {type OwnProps} from './container'

const mapStateToProps = (state: TypedState, {infoPanelOpen}: OwnProps) => {
  const conversationIDKey = Constants2.getSelectedConversation(state)
  const _meta = Constants2.getMeta(state, conversationIDKey)
  return {
    _meta,
    badgeNumber: state.notifications.getIn(['navBadges', chatTab]),
    canOpenInfoPanel: true, //! Constants.isPendingConversationIDKey(Constants.getSelectedConversation(state) || ''),
    infoPanelOpen,
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
  channelName: stateProps._meta.channelname,
  infoPanelOpen: stateProps.infoPanelOpen,
  muted: stateProps._meta.isMuted,
  onBack: dispatchProps.onBack,
  onOpenFolder: dispatchProps.onOpenFolder,
  onShowProfile: dispatchProps.onShowProfile,
  onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
  smallTeam: stateProps._meta.teamType !== 'big',
  teamName: stateProps._meta.teamname,
  participants: stateProps._meta.teamname ? [] : stateProps._meta.participants.toArray(),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !!props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
