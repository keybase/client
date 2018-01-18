// @noflow
import * as React from 'react'
import * as Constants2 from '../../../constants/chat2'
import * as Types from '../../../constants/types/chat2'
import * as TeamTypes from '../../../constants/types/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel} from '.'
import {connect, type TypedState} from '../../../util/container'
import {getCanPerform} from '../../../constants/teams'
import {navigateAppend, navigateTo} from '../../../actions/route-tree'
import {chatTab, teamsTab} from '../../../constants/tabs'
import {createShowUserProfile} from '../../../actions/profile-gen'

// const getPreviewState = createSelector([Constants.getSelectedInbox], inbox => {
// return {isPreview: (inbox && inbox.memberStatus) === ChatTypes.commonConversationMemberStatus.preview}
// })

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants2.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    return {}
  }
  const _meta = Constants2.getMeta(state, selectedConversationIDKey)

  return {
    _meta,
    admin: _meta.teamname ? getCanPerform(state, _meta.teamname).renameChannel : false,
    isPreview: false, // TODO
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _navToRootChat: () => dispatch(navigateTo([chatTab])),
  _onLeaveConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createLeaveConversation({conversationIDKey})),
  _onJoinChannel: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createJoinConversation({conversationIDKey})),
  _onMuteConversation: (conversationIDKey: Types.ConversationIDKey, muted: boolean) =>
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted})),
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

const mergeProps = (stateProps, dispatchProps) => {
  const selectedConversationIDKey = stateProps._meta.conversationIDKey
  const teamname = stateProps._meta.teamname

  return {
    ...stateProps,
    teamname,
    selectedConversationIDKey,
    ...dispatchProps,
    onLeaveConversation: () => {
      if (selectedConversationIDKey) {
        dispatchProps._navToRootChat()
        dispatchProps._onLeaveConversation(selectedConversationIDKey)
      }
    },
    onJoinChannel: () => dispatchProps._onJoinChannel(selectedConversationIDKey),
    onMuteConversation: (muted: boolean) =>
      selectedConversationIDKey && dispatchProps._onMuteConversation(selectedConversationIDKey, muted),
    onShowBlockConversationDialog: () =>
      dispatchProps._onShowBlockConversationDialog(
        selectedConversationIDKey,
        stateProps._meta.participants.join(',')
      ),
    onShowNewTeamDialog: () => {
      selectedConversationIDKey && dispatchProps._onShowNewTeamDialog(selectedConversationIDKey)
    },
    onLeaveTeam: () => dispatchProps._onLeaveTeam(teamname),
    onViewTeam: () => dispatchProps._onViewTeam(teamname),
  }
}

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
  const selectedConversationIDKey = Constants2.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    return {}
  }
  const meta = Constants2.getMeta(state, selectedConversationIDKey)
  if (!meta) {
    return {}
  }

  return {
    channelname: meta.channelname,
    selectedConversationIDKey,
    smallTeam: meta.teamType !== 'big',
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
