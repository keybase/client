import * as TeamConstants from '../../../../constants/teams'
import * as ChatConstants from '../../../../constants/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewTeamBuilder} from '../../../../actions/typed-routes'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as ChatGen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import {InfoPanelMenu, ConvProps} from '.'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import * as Styles from '../../../../styles'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  isSmallTeam: boolean
  teamID?: TeamTypes.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
  visible: boolean
}

// can be expensive, don't run if not visible
const moreThanOneSubscribedChannel = (
  inboxLayout: Container.TypedState['chat2']['inboxLayout'],
  teamname?: string
) => {
  if (!inboxLayout || !inboxLayout.bigTeams) {
    return false
  }
  const bigTeams = inboxLayout.bigTeams
  let found = 0
  return bigTeams.some(c => {
    if (c.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel && c.channel.teamname === teamname) {
      found++
    }
    // got enough
    if (found === 2) {
      return true
    }
    return false
  })
}

export default Container.namedConnect(
  (state, {conversationIDKey, isSmallTeam, teamID: _teamID, visible}: OwnProps) => {
    let convProps: ConvProps | undefined
    let teamDetails: TeamTypes.TeamDetails | undefined
    let teamname: string = ''
    let teamID: TeamTypes.TeamID = TeamTypes.noTeamID
    if (conversationIDKey && conversationIDKey !== ChatConstants.noConversationIDKey) {
      const meta = state.chat2.metaMap.get(conversationIDKey) || ChatConstants.makeConversationMeta()
      const participants = ChatConstants.getRowParticipants(meta, state.config.username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 &&
          (state.users.infoMap.get(participants[0]) || {fullname: ''}).fullname) ||
        ''
      const isTeam = meta.teamType === 'big' || meta.teamType === 'small'
      teamDetails = isTeam ? TeamConstants.getTeamDetails(state, meta.teamID) : undefined
      teamname = meta.teamname
      teamID = meta.teamID
      convProps = {
        fullname,
        ignored: meta.status === RPCChatTypes.ConversationStatus.ignored,
        muted: meta.isMuted,
        participants,
        teamID: meta.teamID,
        teamType: meta.teamType,
        teamname,
      }
    } else if (_teamID) {
      teamID = _teamID
      teamDetails = TeamConstants.getTeamDetails(state, teamID)
      teamname = teamDetails.teamname
    }
    // skip a bunch of stuff for menus that aren't visible
    if (!visible) {
      return {
        badgeSubscribe: false,
        canAddPeople: false,
        convProps,
        isSmallTeam: false,
        manageChannelsSubtitle: '',
        manageChannelsTitle: '',
        memberCount: 0,
        teamname: '',
      }
    }

    const yourOperations = TeamConstants.getCanPerformByID(state, teamID)
    const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(state, teamname)

    const manageChannelsTitle = isSmallTeam
      ? 'Create chat channels...'
      : moreThanOneSubscribedChannel(state.chat2.inboxLayout, teamname)
      ? 'Manage chat channels'
      : 'Subscribe to channels...'
    const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''
    return {
      _teamID: convProps?.teamID ?? teamID,
      badgeSubscribe,
      canAddPeople: yourOperations.manageMembers,
      convProps,
      isSmallTeam,
      manageChannelsSubtitle,
      manageChannelsTitle,
      memberCount: teamDetails ? teamDetails.memberCount : 0,
      teamname,
    }
  },
  (dispatch, {conversationIDKey}: OwnProps) => ({
    _onAddPeople: (teamID?: TeamTypes.TeamID) => teamID && dispatch(appendNewTeamBuilder(teamID)),
    _onBlockConv: (team: string, others: Array<string>) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {blockByDefault: others.length === 1, convID: conversationIDKey, others, team},
              selected: 'chatBlockingModal',
            },
          ],
        })
      ),
    _onInvite: (teamID?: TeamTypes.TeamID) => {
      const selected = Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
      if (!teamID) return
      return dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected}]}))
    },
    _onLeaveTeam: (teamID?: TeamTypes.TeamID) =>
      teamID &&
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamReallyLeaveTeam'}]})
      ),
    _onManageChannels: (teamname?: string) => {
      teamname &&
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
        )
      teamname && dispatch(TeamsGen.createAddTeamWithChosenChannels({teamname}))
    },
    _onViewTeam: (teamID?: TeamTypes.TeamID) => {
      teamID && dispatch(RouteTreeGen.createClearModals())
      teamID && dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
    onHideConv: () => dispatch(ChatGen.createHideConversation({conversationIDKey})),
    onMuteConv: (muted: boolean) => dispatch(ChatGen.createMuteConversation({conversationIDKey, muted})),
    onUnhideConv: () => dispatch(ChatGen.createUnhideConversation({conversationIDKey})),
  }),
  (s, d, o) => ({
    attachTo: o.attachTo,
    badgeSubscribe: s.badgeSubscribe,
    canAddPeople: s.canAddPeople,
    convProps: s.convProps,
    isSmallTeam: s.isSmallTeam,
    manageChannelsSubtitle: s.manageChannelsSubtitle,
    manageChannelsTitle: s.manageChannelsTitle,
    memberCount: s.memberCount,
    onAddPeople: () => d._onAddPeople(s.convProps?.teamID || undefined),
    onBlockConv: () => d._onBlockConv(s.teamname, s.convProps?.participants ?? []),
    onHidden: o.onHidden,
    onHideConv: d.onHideConv,
    onInvite: () => d._onInvite(s._teamID),
    onLeaveTeam: () => d._onLeaveTeam(s._teamID),
    onManageChannels: () => d._onManageChannels(s.teamname),
    onMuteConv: d.onMuteConv,
    onUnhideConv: d.onUnhideConv,
    onViewTeam: () => d._onViewTeam(s._teamID || undefined),
    teamname: s.teamname,
    visible: o.visible,
  }),
  'TeamDropdownMenu'
)(InfoPanelMenu)
