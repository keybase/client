import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {InfoPanelMenu} from '.'

export type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  onHidden: () => void
  floatingMenuContainerStyle?: Kb.Styles.StylesCrossPlatform
  hasHeader: boolean
  isSmallTeam: boolean
  teamID?: T.Teams.TeamID
  visible: boolean
}

const InfoPanelMenuConnectorVisible = React.memo(function InfoPanelMenuConnectorVisible(p: OwnProps) {
  const {visible} = p
  return visible ? <InfoPanelMenuConnector {...p} /> : null
})

const InfoPanelMenuConnector = React.memo(function InfoPanelMenuConnector(p: OwnProps) {
  const {attachTo, onHidden, floatingMenuContainerStyle, hasHeader} = p
  const {isSmallTeam, teamID: pteamID} = p
  const visible = true

  const username = C.useCurrentUserState(s => s.username)

  const infoMap = C.useUsersState(s => s.infoMap)
  const participantInfo = C.useChatContext(s => s.participants)
  const meta = C.useChatContext(s => s.meta)
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
      teamID: T.Teams.noTeamID,
      teamType: undefined,
      teamname: '',
    }

    if (meta.conversationIDKey !== C.Chat.noConversationIDKey) {
      const participants = C.Chat.getRowParticipants(participantInfo, username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 && (infoMap.get(participants[0]!) || {fullname: ''}).fullname) || ''
      const {teamID, teamname, channelname, membershipType, status, isMuted, teamType} = meta
      // TODO getCanPerformByID not reactive here
      const yourOperations = C.Teams.getCanPerformByID(C.useTeamsState.getState(), teamID)
      const badgeSubscribe = !C.Teams.isTeamWithChosenChannels(C.useTeamsState.getState(), teamname)
      const canAddPeople = yourOperations.manageMembers
      const isInChannel = membershipType !== 'youArePreviewing'
      const ignored = status === T.RPCChat.ConversationStatus.ignored
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
      const teamMeta = C.Teams.getTeamMeta(C.useTeamsState.getState(), teamID)
      //TODO not reactive
      const yourOperations = C.Teams.getCanPerformByID(C.useTeamsState.getState(), teamID)
      const canAddPeople = yourOperations.manageMembers
      const {teamname} = teamMeta
      const badgeSubscribe = !C.Teams.isTeamWithChosenChannels(C.useTeamsState.getState(), teamname)
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
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const onBlockConv = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {
        blockUserByDefault: participants.length === 1,
        conversationIDKey,
        others: participants,
        team: teamname,
      },
      selected: 'chatBlockingModal',
    }))
  }, [navigateAppend, teamname, participants])
  const onInvite = React.useCallback(() => {
    const selected = Kb.Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
    teamID && navigateAppend(() => ({props: {teamID}, selected}))
  }, [navigateAppend, teamID])

  const onJoinChannel = C.useChatContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = C.useChatContext(s => s.dispatch.leaveConversation)
  const onLeaveTeam = React.useCallback(
    () => teamID && navigateAppend(() => ({props: {teamID}, selected: 'teamReallyLeaveTeam'})),
    [navigateAppend, teamID]
  )
  const addTeamWithChosenChannels = C.useTeamsState(s => s.dispatch.addTeamWithChosenChannels)
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
    addTeamWithChosenChannels(teamID)
  }, [manageChatChannels, addTeamWithChosenChannels, teamID])
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const markTeamAsRead = C.useChatContext(s => s.dispatch.markTeamAsRead)
  const onMarkAsRead = React.useCallback(() => {
    clearModals()
    markTeamAsRead(teamID)
  }, [clearModals, markTeamAsRead, teamID])
  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const onMarkAsUnread = React.useCallback(() => {
    clearModals()
    setMarkAsUnread()
  }, [clearModals, setMarkAsUnread])
  const onViewTeam = React.useCallback(() => {
    clearModals()
    navigateAppend(() => ({props: {teamID}, selected: 'team'}))
  }, [clearModals, navigateAppend, teamID])
  const hideConversation = C.useChatContext(s => s.dispatch.hideConversation)
  const onHideConv = React.useCallback(() => {
    hideConversation(true)
  }, [hideConversation])
  const onMuteConv = C.useChatContext(s => s.dispatch.mute)
  const onUnhideConv = React.useCallback(() => {
    hideConversation(false)
  }, [hideConversation])

  const props = {
    attachTo,
    badgeSubscribe,
    canAddPeople,
    channelname,
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
