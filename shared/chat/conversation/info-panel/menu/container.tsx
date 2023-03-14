import * as ChatConstants from '../../../../constants/chat2'
import * as ChatGen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import * as TeamConstants from '../../../../constants/teams'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
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
      const participants = ChatConstants.getRowParticipants(participantInfo, state.config.username)
      // If it's a one-on-one chat, we need the user's fullname.
      const fullname =
        (participants.length === 1 &&
          (state.users.infoMap.get(participants[0]) || {fullname: ''}).fullname) ||
        ''
      const {teamID, teamname, channelname, membershipType, status, isMuted, teamType} = meta
      const yourOperations = TeamConstants.getCanPerformByID(state, teamID)
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(state, teamname)
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
        yourOperations,
      }
    } else if (pteamID) {
      const teamID = pteamID
      const teamMeta = TeamConstants.getTeamMeta(state, teamID)
      const yourOperations = TeamConstants.getCanPerformByID(state, teamID)
      const canAddPeople = yourOperations.manageMembers
      const {teamname} = teamMeta
      const badgeSubscribe = !TeamConstants.isTeamWithChosenChannels(state, teamname)
      return {...common, badgeSubscribe, canAddPeople, teamID, teamname, yourOperations}
    }
    return {...common}
  }, shallowEqual)

  const {teamname, teamID, badgeSubscribe, canAddPeople, channelname, isInChannel, ignored} = data
  const {manageChannelsSubtitle, manageChannelsTitle, participants, teamType, isMuted} = data

  const dispatch = Container.useDispatch()

  const onAddPeople = React.useCallback(() => {
    teamID && dispatch(TeamsGen.createStartAddMembersWizard({teamID}))
  }, [dispatch, teamID])
  const onBlockConv = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              blockUserByDefault: participants.length === 1,
              convID: conversationIDKey,
              others: participants,
              team: teamname,
            },
            selected: 'chatBlockingModal',
          },
        ],
      })
    )
  }, [dispatch, teamname, participants, conversationIDKey])
  const onInvite = React.useCallback(() => {
    const selected = Styles.isMobile ? 'teamInviteByContact' : 'teamInviteByEmail'
    teamID && dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected}]}))
  }, [dispatch, teamID])

  const onJoinChannel = React.useCallback(
    () => dispatch(ChatGen.createJoinConversation({conversationIDKey})),
    [dispatch, conversationIDKey]
  )
  const onLeaveChannel = React.useCallback(
    () => dispatch(ChatGen.createLeaveConversation({conversationIDKey})),
    [dispatch, conversationIDKey]
  )
  const onLeaveTeam = React.useCallback(
    () =>
      teamID &&
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamReallyLeaveTeam'}]})
      ),
    [dispatch, teamID]
  )
  const onManageChannels = React.useCallback(() => {
    dispatch(TeamsGen.createManageChatChannels({teamID}))
    dispatch(TeamsGen.createAddTeamWithChosenChannels({teamID}))
  }, [dispatch, teamID])
  const onMarkAsRead = React.useCallback(() => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ChatGen.createMarkTeamAsRead({teamID}))
  }, [dispatch, teamID])
  const onMarkAsUnread = React.useCallback(() => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ChatGen.createMarkAsUnread({conversationIDKey, readMsgID: null}))
  }, [dispatch, conversationIDKey])
  const onViewTeam = React.useCallback(() => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
  }, [dispatch, teamID])
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
