import * as C from '../../../../constants'
import * as ChatConstants from '../../../../constants/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as TeamConstants from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import {InfoPanelMenu} from '.'
import {ConvoIDContext} from '../../messages/ids-context'

export type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  floatingMenuContainerStyle?: Styles.StylesCrossPlatform
  hasHeader: boolean
  isSmallTeam: boolean
  teamID?: TeamTypes.TeamID
  visible: boolean
}

const InfoPanelMenuConnectorVisible = React.memo(function InfoPanelMenuConnectorVisible(p: OwnProps) {
  const {visible} = p
  return visible ? <InfoPanelMenuConnector {...p} /> : null
})

const InfoPanelMenuConnector = React.memo(function InfoPanelMenuConnector(p: OwnProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {attachTo, onHidden, floatingMenuContainerStyle, hasHeader} = p
  const {isSmallTeam, teamID: pteamID} = p
  const visible = true

  const username = C.useCurrentUserState(s => s.username)

  const infoMap = C.useUsersState(s => s.infoMap)
  const participantInfo = ChatConstants.useContext(s => s.participants)
  const meta = ChatConstants.useContext(s => s.meta)
  const data = (() => {
    const manageChannelsTitle = isSmallTeam ? 'Create channels...' : 'Browse all channels'
    const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''

    const common = {
      badgeSubscribe: false,
      canAddPeople: false,
      channelname: '',
      ignored: false,
      isInChannel: false,
      isMuted: false,
      manageChannelsSubtitle,
      manageChannelsTitle,
      participants: [],
      teamID: TeamTypes.noTeamID,
      teamType: undefined,
      teamname: '',
    }

    if (meta.conversationIDKey !== ChatConstants.noConversationIDKey) {
      const participants = ChatConstants.getRowParticipants(participantInfo, username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 && (infoMap.get(participants[0]!) || {fullname: ''}).fullname) || ''
      const {teamID, teamname, channelname, membershipType, status, isMuted, teamType} = meta
      // TODO getCanPerformByID not reactive here
      const yourOperations = TeamConstants.getCanPerformByID(C.useTeamsState.getState(), teamID)
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(C.useTeamsState.getState(), teamname)
      const canAddPeople = yourOperations.manageMembers
      const isInChannel = membershipType !== 'youArePreviewing'
      const ignored = status === RPCChatTypes.ConversationStatus.ignored
      return {
        ...common,
        badgeSubscribe,
        canAddPeople,
        channelname,
        fullname,
        ignored,
        isInChannel,
        isMuted,
        participants,
        teamID,
        teamType,
        teamname,
      }
    } else if (pteamID) {
      const teamID = pteamID
      //TODO not reactive
      const teamMeta = TeamConstants.getTeamMeta(C.useTeamsState.getState(), teamID)
      //TODO not reactive
      const yourOperations = TeamConstants.getCanPerformByID(C.useTeamsState.getState(), teamID)
      const canAddPeople = yourOperations.manageMembers
      const {teamname} = teamMeta
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(C.useTeamsState.getState(), teamname)
      return {...common, badgeSubscribe, canAddPeople, teamID, teamname, yourOperations}
    }
    return {...common}
  })()

  const {teamname, teamID, badgeSubscribe, canAddPeople, channelname, isInChannel, ignored} = data
  const {manageChannelsSubtitle, manageChannelsTitle, participants, teamType, isMuted} = data
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onAddPeople = React.useCallback(() => {
    teamID && startAddMembersWizard(teamID)
  }, [startAddMembersWizard, teamID])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onBlockConv = React.useCallback(() => {
    navigateAppend({
      props: {
        blockUserByDefault: participants.length === 1,
        convID: conversationIDKey,
        others: participants,
        team: teamname,
      },
      selected: 'chatBlockingModal',
    })
  }, [navigateAppend, teamname, participants, conversationIDKey])
  const onInvite = React.useCallback(() => {
    const selected = Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
    teamID && navigateAppend({props: {teamID}, selected})
  }, [navigateAppend, teamID])

  const onJoinChannel = ChatConstants.useContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = ChatConstants.useContext(s => s.dispatch.leaveConversation)
  const onLeaveTeam = React.useCallback(
    () => teamID && navigateAppend({props: {teamID}, selected: 'teamReallyLeaveTeam'}),
    [navigateAppend, teamID]
  )
  const addTeamWithChosenChannels = C.useTeamsState(s => s.dispatch.addTeamWithChosenChannels)
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
    addTeamWithChosenChannels(teamID)
  }, [manageChatChannels, addTeamWithChosenChannels, teamID])
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const markTeamAsRead = ChatConstants.useContext(s => s.dispatch.markTeamAsRead)
  const onMarkAsRead = React.useCallback(() => {
    clearModals()
    markTeamAsRead(teamID)
  }, [clearModals, markTeamAsRead, teamID])
  const setMarkAsUnread = ChatConstants.useContext(s => s.dispatch.setMarkAsUnread)
  const onMarkAsUnread = React.useCallback(() => {
    clearModals()
    setMarkAsUnread()
  }, [clearModals, setMarkAsUnread])
  const onViewTeam = React.useCallback(() => {
    clearModals()
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [clearModals, navigateAppend, teamID])
  const hideConversation = ChatConstants.useContext(s => s.dispatch.hideConversation)
  const onHideConv = React.useCallback(() => {
    hideConversation(true)
  }, [hideConversation])
  const onMuteConv = ChatConstants.useContext(s => s.dispatch.mute)
  const onUnhideConv = React.useCallback(() => {
    hideConversation(false)
  }, [hideConversation])

  const props = {
    attachTo,
    badgeSubscribe,
    canAddPeople,
    channelname,
    conversationIDKey,
    floatingMenuContainerStyle,
    hasHeader,
    ignored,
    isInChannel,
    isMuted,
    isSmallTeam,
    manageChannelsSubtitle,
    manageChannelsTitle,
    onAddPeople,
    onBlockConv,
    onHidden,
    onHideConv,
    onInvite,
    onJoinChannel,
    onLeaveChannel,
    onLeaveTeam,
    onManageChannels,
    onMarkAsRead,
    onMarkAsUnread,
    onMuteConv,
    onUnhideConv,
    onViewTeam,
    teamID,
    teamType,
    teamname,
    visible,
  }

  return <InfoPanelMenu {...props} />
})

export default InfoPanelMenuConnectorVisible
