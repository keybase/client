import * as TeamConstants from '../../../../constants/teams'
import * as ChatConstants from '../../../../constants/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewTeamBuilder} from '../../../../actions/typed-routes'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as ChatGen from '../../../../actions/chat2-gen'
import {namedConnect} from '../../../../util/container'
import {InfoPanelMenu, ConvProps} from '.'
import * as ChatTypes from '../../../../constants/types/chat2'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  isSmallTeam: boolean
  teamname?: string
  conversationIDKey: ChatTypes.ConversationIDKey
  visible: boolean
}

// can be expensive, don't run if not visible
const moreThanOneSubscribedChannel = (metaMap, teamname) => {
  let found = 0
  return metaMap.some(c => {
    if (c.teamname === teamname) {
      found++
    }
    // got enough
    if (found === 2) {
      return true
    }
    return false
  })
}

const mapStateToProps = (state, {teamname, conversationIDKey, isSmallTeam, visible}: OwnProps) => {
  let convProps: ConvProps | null = null
  if (conversationIDKey && conversationIDKey !== ChatConstants.noConversationIDKey) {
    const meta = state.chat2.metaMap.get(conversationIDKey, ChatConstants.makeConversationMeta())
    const participants = ChatConstants.getRowParticipants(meta, state.config.username || '').toArray()
    // If it's a one-on-one chat, we need the user's fullname.
    const fullname =
      participants.length === 1 ? state.users.infoMap.get(participants[0], {fullname: ''}).fullname : ''
    convProps = {
      fullname,
      ignored: meta.status === RPCChatTypes.ConversationStatus.ignored,
      muted: meta.isMuted,
      participants,
      teamType: meta.teamType,
    }
  }
  // skip a bunch of stuff for menus that aren't visible
  if (!visible) {
    return {
      badgeSubscribe: false,
      canAddPeople: false,
      convProps,
      hasCanPerform: false,
      isSmallTeam: false,
      manageChannelsSubtitle: '',
      manageChannelsTitle: '',
      memberCount: 0,
      teamname,
    }
  }
  const yourOperations = TeamConstants.getCanPerform(state, teamname || '')
  // We can get here without loading canPerform
  const hasCanPerform = teamname ? TeamConstants.hasCanPerform(state, teamname) : false
  const badgeSubscribe = !teamname || !TeamConstants.isTeamWithChosenChannels(state, teamname)

  const manageChannelsTitle = isSmallTeam
    ? 'Create chat channels...'
    : moreThanOneSubscribedChannel(state.chat2.metaMap, teamname)
    ? 'Manage chat channels'
    : 'Subscribe to channels...'
  const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''
  return {
    badgeSubscribe,
    canAddPeople: yourOperations.manageMembers,
    convProps,
    hasCanPerform,
    isSmallTeam,
    manageChannelsSubtitle,
    manageChannelsTitle,
    memberCount: teamname ? TeamConstants.getTeamMemberCount(state, teamname) : 0,
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {teamname, conversationIDKey}: OwnProps) => ({
  loadOperations: () => teamname && dispatch(TeamsGen.createGetTeamOperations({teamname})),
  onAddPeople: () => teamname && dispatch(appendNewTeamBuilder(teamname)),
  onHideConv: () => dispatch(ChatGen.createHideConversation({conversationIDKey})),
  onInvite: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamInviteByEmail'}]})),
  onLeaveTeam: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamReallyLeaveTeam'}]})
    )
  },
  onManageChannels: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]}))
    teamname && dispatch(TeamsGen.createAddTeamWithChosenChannels({teamname}))
  },
  onMuteConv: (muted: boolean) => dispatch(ChatGen.createMuteConversation({conversationIDKey, muted})),
  onUnhideConv: () => dispatch(ChatGen.createUnhideConversation({conversationIDKey})),
  onViewTeam: () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
  },
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'TeamDropdownMenu'
)(InfoPanelMenu)
