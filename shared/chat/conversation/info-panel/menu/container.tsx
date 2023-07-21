import * as ChatConstants from '../../../../constants/chat2'
import * as RouterConstants from '../../../../constants/router2'
import * as UsersConstants from '../../../../constants/users'
import * as ConfigConstants from '../../../../constants/config'
import * as ChatGen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as TeamConstants from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import shallowEqual from 'shallowequal'
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

  const username = ConfigConstants.useCurrentUserState(s => s.username)

  const infoMap = UsersConstants.useState(s => s.infoMap)
  const data = Container.useSelector(state => {
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

    if (conversationIDKey && conversationIDKey !== ChatConstants.noConversationIDKey) {
      const meta = ChatConstants.getMeta(state, conversationIDKey)
      const participantInfo = ChatConstants.getParticipantInfo(state, conversationIDKey)
      const participants = ChatConstants.getRowParticipants(participantInfo, username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 && (infoMap.get(participants[0]!) || {fullname: ''}).fullname) || ''
      const {teamID, teamname, channelname, membershipType, status, isMuted, teamType} = meta
      // TODO getCanPerformByID not reactive here
      const yourOperations = TeamConstants.getCanPerformByID(TeamConstants.useState.getState(), teamID)
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(
        TeamConstants.useState.getState(),
        teamname
      )
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
      const teamMeta = TeamConstants.getTeamMeta(TeamConstants.useState.getState(), teamID)
      //TODO not reactive
      const yourOperations = TeamConstants.getCanPerformByID(TeamConstants.useState.getState(), teamID)
      const canAddPeople = yourOperations.manageMembers
      const {teamname} = teamMeta
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(
        TeamConstants.useState.getState(),
        teamname
      )
      return {...common, badgeSubscribe, canAddPeople, teamID, teamname, yourOperations}
    }
    return {...common}
  }, shallowEqual)

  const {teamname, teamID, badgeSubscribe, canAddPeople, channelname, isInChannel, ignored} = data
  const {manageChannelsSubtitle, manageChannelsTitle, participants, teamType, isMuted} = data

  const dispatch = Container.useDispatch()

  const startAddMembersWizard = TeamConstants.useState(s => s.dispatch.startAddMembersWizard)
  const onAddPeople = React.useCallback(() => {
    teamID && startAddMembersWizard(teamID)
  }, [startAddMembersWizard, teamID])
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
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

  const onJoinChannel = React.useCallback(
    () => dispatch(ChatGen.createJoinConversation({conversationIDKey})),
    [dispatch, conversationIDKey]
  )
  const onLeaveChannel = React.useCallback(
    () => dispatch(ChatGen.createLeaveConversation({conversationIDKey})),
    [dispatch, conversationIDKey]
  )
  const onLeaveTeam = React.useCallback(
    () => teamID && navigateAppend({props: {teamID}, selected: 'teamReallyLeaveTeam'}),
    [navigateAppend, teamID]
  )
  const addTeamWithChosenChannels = TeamConstants.useState(s => s.dispatch.addTeamWithChosenChannels)
  const manageChatChannels = TeamConstants.useState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
    addTeamWithChosenChannels(teamID)
  }, [manageChatChannels, addTeamWithChosenChannels, teamID])
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onMarkAsRead = React.useCallback(() => {
    clearModals()
    dispatch(ChatGen.createMarkTeamAsRead({teamID}))
  }, [clearModals, dispatch, teamID])
  const onMarkAsUnread = React.useCallback(() => {
    clearModals()
    dispatch(ChatGen.createMarkAsUnread({conversationIDKey}))
  }, [clearModals, dispatch, conversationIDKey])
  const onViewTeam = React.useCallback(() => {
    clearModals()
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [clearModals, navigateAppend, teamID])
  const onHideConv = React.useCallback(() => {
    dispatch(ChatGen.createHideConversation({conversationIDKey}))
  }, [conversationIDKey, dispatch])
  const onMuteConv = React.useCallback(
    (muted: boolean) => {
      dispatch(ChatGen.createMuteConversation({conversationIDKey, muted}))
    },
    [conversationIDKey, dispatch]
  )
  const onUnhideConv = React.useCallback(() => {
    dispatch(ChatGen.createUnhideConversation({conversationIDKey}))
  }, [conversationIDKey, dispatch])

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
