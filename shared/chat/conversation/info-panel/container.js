// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import * as TeamTypes from '../../../constants/types/teams'
import * as ChatGen from '../../../actions/chat-gen'
import {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel} from '.'
import {Map} from 'immutable'
import {connect, type TypedState} from '../../../util/container'
import {getCanPerform} from '../../../constants/teams'
import {createSelector} from 'reselect'
import {navigateAppend, navigateTo, navigateUp} from '../../../actions/route-tree'
import {chatTab, teamsTab} from '../../../constants/tabs'
import {createShowUserProfile} from '../../../actions/profile-gen'
import * as ChatTypes from '../../../constants/types/rpc-chat-gen'

const getParticipants = createSelector(
  [
    Constants.getYou,
    Constants.getParticipantsWithFullNames,
    Constants.getFollowing,
    Constants.getMetaDataMap,
  ],
  (you, users, followingMap, metaDataMap) => {
    return users.map(user => {
      const username = user.username
      const following = followingMap.has(username)
      const meta = metaDataMap.get(username, Map({}))
      const fullname = user.fullname ? user.fullname : meta.get('fullname') || ''
      const broken = meta.get('brokenTracker') || false
      return {
        broken,
        following,
        fullname,
        meta,
        username,
      }
    })
  }
)

const getPreviewState = createSelector([Constants.getSelectedInbox], inbox => {
  return {isPreview: (inbox && inbox.memberStatus) === ChatTypes.commonConversationMemberStatus.preview}
})

type StateProps = {
  isPreview?: boolean,
  admin?: boolean,
  channelname?: ?string,
  muted?: ?boolean,
  participants?: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
  }>,
  selectedConversationIDKey?: Types.ConversationIDKey,
  showTeamButton?: boolean,
  teamname?: ?string,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  if (!selectedConversationIDKey || !inbox) {
    return {}
  }
  const channelname = inbox.get('channelname')
  const teamname = inbox.get('teamname')

  let admin = false
  if (teamname) {
    const yourOperations = getCanPerform(state, teamname)
    admin = yourOperations.renameChannel
  }

  return {
    ...getPreviewState(state),
    admin,
    channelname,
    muted: Constants.getMuted(state),
    participants: getParticipants(state),
    selectedConversationIDKey,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _navToRootChat: () => dispatch(navigateTo([chatTab])),
  _onLeaveConversation: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(ChatGen.createLeaveConversation({conversationIDKey}))
  },
  _onJoinChannel: (selectedConversation: Types.ConversationIDKey) => {
    dispatch(ChatGen.createJoinConversation({conversationIDKey: selectedConversation}))
  },
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) => {
    dispatch(ChatGen.createMuteConversation({conversationIDKey, muted}))
  },
  _onShowBlockConversationDialog: (selectedConversation, participants) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey: selectedConversation, participants},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  _onShowNewTeamDialog: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey},
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  _onLeaveTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'reallyLeaveTeam'}])),
  _onViewTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  // Used by HeaderHoc.
  onBack: () => dispatch(navigateUp()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onLeaveConversation: () => {
    if (stateProps.selectedConversationIDKey) {
      dispatchProps._navToRootChat()
      dispatchProps._onLeaveConversation(stateProps.selectedConversationIDKey)
    }
  },
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps.selectedConversationIDKey),
  onMuteConversation:
    stateProps.selectedConversationIDKey &&
    !Constants.isPendingConversationIDKey(stateProps.selectedConversationIDKey)
      ? (muted: boolean) =>
          stateProps.selectedConversationIDKey &&
          dispatchProps._onMuteConversation(stateProps.selectedConversationIDKey, muted)
      : null,
  onShowBlockConversationDialog: () =>
    dispatchProps._onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      (stateProps.participants || []).map(p => p.username).join(',')
    ),
  onShowNewTeamDialog: () => {
    stateProps.selectedConversationIDKey &&
      dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey)
  },
  onLeaveTeam: () => dispatchProps._onLeaveTeam(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
})

const ConnectedBigTeamInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamInfoPanel)

const ConnectedSmallTeamInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  SmallTeamInfoPanel
)

const ConnectedConversationInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  ConversationInfoPanel
)

type SelectorProps = {
  channelname?: ?string,
  selectedConversationIDKey?: Types.ConversationIDKey,
  smallTeam?: boolean,
}

const mapStateToSelectorProps = (state: TypedState): SelectorProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  if (!selectedConversationIDKey || !inbox) {
    return {}
  }
  const channelname = inbox.get('channelname')
  const smallTeam = Constants.getTeamType(state) === ChatTypes.commonTeamType.simple

  return {
    channelname,
    selectedConversationIDKey,
    smallTeam,
  }
}

class InfoPanelSelector extends React.PureComponent<SelectorProps> {
  render() {
    if (!this.props.selectedConversationIDKey) {
      return null
    }

    if (this.props.smallTeam) {
      return <ConnectedSmallTeamInfoPanel />
    }

    if (this.props.channelname) {
      return <ConnectedBigTeamInfoPanel />
    }

    return <ConnectedConversationInfoPanel />
  }
}

const ConnectedInfoPanel = connect(mapStateToSelectorProps)(InfoPanelSelector)

export default ConnectedInfoPanel
