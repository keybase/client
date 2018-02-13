// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import * as TeamTypes from '../../../constants/types/teams'
import * as ChatGen from '../../../actions/chat-gen'
import {InfoPanel, type InfoPanelProps} from '.'
import {type ParticipantInfo} from './participant'
import {Map} from 'immutable'
import {connect, type TypedState} from '../../../util/container'
import {getCanPerform} from '../../../constants/teams'
import {createSelector} from 'reselect'
import {navigateAppend, navigateTo} from '../../../actions/route-tree'
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
        isYou: username === you,
        username,
      }
    })
  }
)

const getPreviewState = createSelector([Constants.getSelectedInbox], inbox => {
  return {isPreview: (inbox && inbox.memberStatus) === ChatTypes.commonConversationMemberStatus.preview}
})

type StateProps = {
  selectedConversationIDKey: Types.ConversationIDKey,
  participants: Array<ParticipantInfo>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  if (!selectedConversationIDKey || !inbox) {
    throw new Error('Impossible')
  }
  const channelname = inbox.get('channelname')
  const teamname = inbox.get('teamname')

  let admin = false
  if (teamname) {
    const yourOperations = getCanPerform(state, teamname)
    admin = yourOperations.renameChannel
  }

  const smallTeam = Constants.getTeamType(state) === ChatTypes.commonTeamType.simple

  return {
    selectedConversationIDKey,
    participants: getParticipants(state),
    ...getPreviewState(state),
    teamname,
    channelname,
    smallTeam,
    admin,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _navToRootChat: () => dispatch(navigateTo([chatTab])),
  _onLeaveConversation: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(ChatGen.createLeaveConversation({conversationIDKey}))
  },
  _onJoinChannel: (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(ChatGen.createJoinConversation({conversationIDKey}))
  },
  _onShowBlockConversationDialog: (conversationIDKey, participants) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey, participants},
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
  _onViewTeam: (teamname: TeamTypes.Teamname) =>
    dispatch(navigateTo([teamsTab, {props: {teamname: teamname}, selected: 'team'}])),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps): InfoPanelProps => ({
  ...stateProps,

  onBack: ownProps.onBack,

  onShowProfile: dispatchProps.onShowProfile,

  onShowBlockConversationDialog: () =>
    dispatchProps._onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      (stateProps.participants || []).map(p => p.username).join(',')
    ),
  onShowNewTeamDialog: () => {
    dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey)
  },

  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),

  onLeaveConversation: () => {
    dispatchProps._navToRootChat()
    dispatchProps._onLeaveConversation(stateProps.selectedConversationIDKey)
  },
  onJoinChannel: () => dispatchProps._onJoinChannel(stateProps.selectedConversationIDKey),
})

const ConnectedInfoPanel = connect(mapStateToProps, mapDispatchToProps, mergeProps)(InfoPanel)

type SelectorStateProps = {
  selectedConversationIDKey: ?Types.ConversationIDKey,
}

const mapStateToSelectorProps = (state: TypedState): SelectorStateProps => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  if (!selectedConversationIDKey || !inbox) {
    return {selectedConversationIDKey: null}
  }

  return {
    selectedConversationIDKey,
  }
}

type SelectorDispatchProps = {
  onBack: () => void,
}

const mapDispatchToSelectorProps = (dispatch: Dispatch, {navigateUp}): SelectorDispatchProps => ({
  // Used by HeaderHoc.
  onBack: () => dispatch(navigateUp()),
})

type SelectorProps = SelectorStateProps & SelectorDispatchProps

class InfoPanelSelector extends React.PureComponent<SelectorProps> {
  render() {
    if (!this.props.selectedConversationIDKey) {
      return null
    }

    return <ConnectedInfoPanel onBack={this.props.onBack} />
  }
}

export default connect(mapStateToSelectorProps, mapDispatchToSelectorProps)(InfoPanelSelector)
