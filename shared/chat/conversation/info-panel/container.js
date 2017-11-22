// @flow
import * as Constants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import * as TeamTypes from '../../../constants/types/teams'
import * as ChatGen from '../../../actions/chat-gen'
import {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel} from '.'
import {Map, Set} from 'immutable'
import {
  compose,
  renderComponent,
  renderNothing,
  branch,
  connect,
  type TypedState,
} from '../../../util/container'
import {getDetails} from '../../../actions/teams/creators'
import {createSelector} from 'reselect'
import {navigateAppend, navigateTo} from '../../../actions/route-tree'
import {lifecycle} from 'recompose'
import {chatTab, teamsTab} from '../../../constants/tabs'
import {createShowUserProfile} from '../../../actions/profile-gen'
import flags from '../../../util/feature-flags'
import * as ChatTypes from '../../../constants/types/flow-types-chat'

const getParticipants = createSelector(
  [
    Constants.getYou,
    Constants.getParticipantsWithFullNames,
    Constants.getFollowingMap,
    Constants.getMetaDataMap,
  ],
  (you, users, followingMap, metaDataMap) => {
    return users.map(user => {
      const username = user.username
      const following = !!followingMap[username]
      const meta = metaDataMap.get(username, Map({}))
      const fullname = user.fullname ? user.fullname : meta.get('fullname') || 'Unknown'
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

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  if (!selectedConversationIDKey || !inbox) {
    return {}
  }
  const channelname = inbox.get('channelname')
  const teamname = inbox.get('teamname')
  const showTeamButton = flags.teamChatEnabled
  const smallTeam = Constants.getTeamType(state) === ChatTypes.commonTeamType.simple
  const myUsername = state.config.username
  let admin = false
  let _loaded = false

  if (teamname) {
    const participants = state.entities.getIn(['teams', 'teamNameToMembers', teamname], Set())
    if (participants.size) {
      _loaded = true
    }
    const myUserInfo = participants.find(participant => participant.username === myUsername)
    if (myUserInfo) {
      admin = myUserInfo.type === 'admin' || myUserInfo.type === 'owner'
    }
  }

  return {
    ...getPreviewState(state),
    admin,
    channelname,
    _loaded,
    muted: Constants.getMuted(state),
    participants: getParticipants(state),
    selectedConversationIDKey,
    showTeamButton,
    teamname,
    smallTeam,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
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
  _onLoadTeam: (teamname: TeamConstants.Teamname) => {
    dispatch(getDetails(teamname))
  },
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
  onMuteConversation: stateProps.selectedConversationIDKey &&
    !Constants.isPendingConversationIDKey(stateProps.selectedConversationIDKey)
    ? (muted: boolean) =>
        stateProps.selectedConversationIDKey &&
        dispatchProps._onMuteConversation(stateProps.selectedConversationIDKey, muted)
    : null,
  onShowBlockConversationDialog: () =>
    dispatchProps._onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      stateProps.participants.map(p => p.username).join(',')
    ),
  onShowNewTeamDialog: () => {
    stateProps.selectedConversationIDKey &&
      dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey)
  },
  onLeaveTeam: () => dispatchProps._onLeaveTeam(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
})

const ConnectedInfoPanel = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.props.teamname && !this.props._loaded && this.props._onLoadTeam(this.props.teamname)
    },
  }),
  branch(props => !props.selectedConversationIDKey, renderNothing),
  branch(props => props.channelname && !props.smallTeam, renderComponent(BigTeamInfoPanel)),
  branch(props => !props.channelname && !props.smallTeam, renderComponent(ConversationInfoPanel))
)(SmallTeamInfoPanel)

export default ConnectedInfoPanel
