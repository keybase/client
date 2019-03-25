// @flow
import * as TeamConstants from '../../../../constants/teams'
import * as ChatConstants from '../../../../constants/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as ChatGen from '../../../../actions/chat2-gen'
import {namedConnect} from '../../../../util/container'
import {InfoPanelMenu} from '.'
import {teamsTab} from '../../../../constants/tabs'
import flags from '../../../../util/feature-flags'
import * as ChatTypes from '../../../../constants/types/chat2'

export type OwnProps = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  isSmallTeam: boolean,
  teamname: string,
  conversationIDKey: ChatTypes.ConversationIDKey,
  visible: boolean,
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
  let convProps = null
  if (conversationIDKey !== ChatConstants.noConversationIDKey) {
    const meta = state.chat2.metaMap.get(conversationIDKey, ChatConstants.makeConversationMeta())
    convProps = {
      ignored: meta.status === RPCChatTypes.commonConversationStatus.ignored,
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
  const yourOperations = TeamConstants.getCanPerform(state, teamname)
  // We can get here without loading canPerform
  const hasCanPerform = TeamConstants.hasCanPerform(state, teamname)
  const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(state, teamname)

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
    memberCount: TeamConstants.getTeamMemberCount(state, teamname),
    teamname,
  }
}

const mapDispatchToProps = (dispatch, {teamname, conversationIDKey}: OwnProps) => ({
  loadOperations: () => dispatch(TeamsGen.createGetTeamOperations({teamname})),
  onAddPeople: () => {
    if (flags.useNewRouter) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'addPeople'}]}))
    } else {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'addPeople'}],
        })
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    }
  },
  onHideConv: () => {
    dispatch(ChatGen.createHideConversation({conversationIDKey}))
  },
  onInvite: () => {
    if (flags.useNewRouter) {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'inviteByEmail'}]}))
    } else {
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: [teamsTab],
          path: [{props: {teamname}, selected: 'team'}, {props: {teamname}, selected: 'inviteByEmail'}],
        })
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    }
  },
  onLeaveTeam: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'reallyLeaveTeam'}]}))
  },
  onManageChannels: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]}))
    dispatch(TeamsGen.createAddTeamWithChosenChannels({teamname}))
  },
  onUnhideConv: () => {
    dispatch(ChatGen.createUnhideConversation({conversationIDKey}))
  },
  onViewTeam: () => {
    if (flags.useNewRouter) {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'team'}]}))
    } else {
      dispatch(
        RouteTreeGen.createNavigateTo({parentPath: [teamsTab], path: [{props: {teamname}, selected: 'team'}]})
      )
      dispatch(RouteTreeGen.createSwitchTo({path: [teamsTab]}))
    }
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'TeamDropdownMenu'
)(InfoPanelMenu)
