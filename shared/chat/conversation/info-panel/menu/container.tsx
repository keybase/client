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
  floatingMenuContainerStyle?: Styles.StylesCrossPlatform
  hasHeader: boolean
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

// TODO convProps was being made all the time and thrashing
// how this works should change. i just normalized this so it doesn't thrash
export default Container.namedConnect(
  (state, {conversationIDKey, isSmallTeam, teamID: _teamID, visible}: OwnProps) => {
    let _convPropsFullname: ConvProps['fullname'] | undefined
    let _convPropsIgnored: ConvProps['ignored'] | undefined
    let _convPropsMuted: ConvProps['muted'] | undefined
    let _convPropsParticipants: ConvProps['participants'] | undefined
    let _convPropsTeamID: ConvProps['teamID'] | undefined
    let _convPropsTeamType: ConvProps['teamType'] | undefined
    let _convPropsTeamname: ConvProps['teamname'] | undefined

    let teamMeta: TeamTypes.TeamMeta | undefined
    let teamname: string = ''
    let channelname: string = ''
    let isInChannel: boolean = false
    let participantsCount: number = 0
    let teamID: TeamTypes.TeamID = TeamTypes.noTeamID
    if (conversationIDKey && conversationIDKey !== ChatConstants.noConversationIDKey) {
      const meta = ChatConstants.getMeta(state, conversationIDKey)
      const participantInfo = ChatConstants.getParticipantInfo(state, conversationIDKey)
      const participants = ChatConstants.getRowParticipants(participantInfo, state.config.username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 &&
          (state.users.infoMap.get(participants[0]) || {fullname: ''}).fullname) ||
        ''
      const isTeam = meta.teamType === 'big' || meta.teamType === 'small'
      teamMeta = isTeam ? TeamConstants.getTeamMeta(state, meta.teamID) : undefined
      teamname = meta.teamname
      channelname = meta.channelname
      teamID = meta.teamID ?? TeamTypes.noTeamID
      isInChannel = meta.membershipType !== 'youArePreviewing'
      participantsCount = participantInfo?.all?.length ?? 0
      _convPropsFullname = fullname
      _convPropsIgnored = meta.status === RPCChatTypes.ConversationStatus.ignored
      _convPropsMuted = meta.isMuted
      _convPropsParticipants = participants
      _convPropsTeamID = meta.teamID
      _convPropsTeamType = meta.teamType
      _convPropsTeamname = teamname
    } else if (_teamID) {
      teamID = _teamID
      teamMeta = TeamConstants.getTeamMeta(state, teamID)
      teamname = teamMeta.teamname
    }
    // skip a bunch of stuff for menus that aren't visible
    if (!visible) {
      return {
        _convPropsFullname,
        _convPropsIgnored,
        _convPropsMuted,
        _convPropsParticipants,
        _convPropsTeamID,
        _convPropsTeamType,
        _convPropsTeamname,
        _teamID: _convPropsTeamID ?? teamID,
        badgeSubscribe: false,
        canAddPeople: false,
        channelname: '',
        hasHeader: false,
        isInChannel: false,
        isSmallTeam: false,
        manageChannelsSubtitle: '',
        manageChannelsTitle: '',
        memberCount: 0,
        participantsCount: 0,
        teamname: '',
      }
    }

    const yourOperations = TeamConstants.getCanPerformByID(state, teamID)
    const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(state, teamname)

    const manageChannelsTitle = isSmallTeam
      ? 'Create channels...'
      : moreThanOneSubscribedChannel(state.chat2.inboxLayout, teamname)
      ? 'Browse all channels'
      : 'Subscribe to channels...'
    const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''
    return {
      _convPropsFullname,
      _convPropsIgnored,
      _convPropsMuted,
      _convPropsParticipants,
      _convPropsTeamID,
      _convPropsTeamType,
      _convPropsTeamname,
      _teamID: _convPropsTeamID ?? teamID,
      badgeSubscribe,
      canAddPeople: yourOperations.manageMembers,
      channelname,
      isInChannel,
      isSmallTeam,
      manageChannelsSubtitle,
      manageChannelsTitle,
      memberCount: teamMeta?.memberCount ?? 0,
      participantsCount,
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
              props: {blockUserByDefault: others.length === 1, convID: conversationIDKey, others, team},
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
    _onJoinChannel: () => dispatch(ChatGen.createJoinConversation({conversationIDKey})),
    _onLeaveChannel: () => dispatch(ChatGen.createLeaveConversation({conversationIDKey})),
    _onLeaveTeam: (teamID?: TeamTypes.TeamID) =>
      teamID &&
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamReallyLeaveTeam'}]})
      ),
    _onManageChannels: (teamID: TeamTypes.TeamID) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'chatManageChannels'}]}))
      dispatch(TeamsGen.createAddTeamWithChosenChannels({teamID}))
    },
    _onViewTeam: (teamID: TeamTypes.TeamID) => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
    },
    onHideConv: () => dispatch(ChatGen.createHideConversation({conversationIDKey})),
    onMuteConv: (muted: boolean) => dispatch(ChatGen.createMuteConversation({conversationIDKey, muted})),
    onUnhideConv: () => dispatch(ChatGen.createUnhideConversation({conversationIDKey})),
  }),
  (s, d, o) => {
    const convProps: ConvProps | undefined =
      s._convPropsFullname != null
        ? {
            fullname: s._convPropsFullname!,
            ignored: s._convPropsIgnored!,
            muted: s._convPropsMuted!,
            participants: s._convPropsParticipants!,
            teamID: s._convPropsTeamID!,
            teamType: s._convPropsTeamType!,
            teamname: s._convPropsTeamname!,
          }
        : undefined

    return {
      attachTo: o.attachTo,
      badgeSubscribe: s.badgeSubscribe,
      canAddPeople: s.canAddPeople,
      channelname: s.channelname,
      convProps,
      floatingMenuContainerStyle: o.floatingMenuContainerStyle,
      hasHeader: o.hasHeader,
      isInChannel: s.isInChannel,
      isSmallTeam: s.isSmallTeam,
      manageChannelsSubtitle: s.manageChannelsSubtitle,
      manageChannelsTitle: s.manageChannelsTitle,
      memberCount: s.memberCount,
      onAddPeople: () => d._onAddPeople(s._teamID),
      onBlockConv: () => d._onBlockConv(s.teamname, s._convPropsParticipants ?? []),
      onHidden: o.onHidden,
      onHideConv: d.onHideConv,
      onInvite: () => d._onInvite(s._teamID),
      onJoinChannel: d._onJoinChannel,
      onLeaveChannel: d._onLeaveChannel,
      onLeaveTeam: () => d._onLeaveTeam(s._teamID),
      onManageChannels: () => d._onManageChannels(s._teamID),
      onMuteConv: d.onMuteConv,
      onUnhideConv: d.onUnhideConv,
      onViewTeam: () => d._onViewTeam(s._teamID),
      participantsCount: s.participantsCount,
      teamname: s.teamname,
      visible: o.visible,
    }
  },
  'TeamDropdownMenu'
)(InfoPanelMenu)
