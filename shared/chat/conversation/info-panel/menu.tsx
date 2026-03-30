import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import type * as React from 'react'
import * as T from '@/constants/types'
import * as InfoPanelCommon from './common'
import {Avatars, TeamAvatar} from '@/chat/avatars'
import {TeamsSubscriberMountOnly} from '@/teams/subscriber'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'

export type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  onHidden: () => void
  floatingMenuContainerStyle?: Kb.Styles.StylesCrossPlatform
  hasHeader: boolean
  isSmallTeam: boolean
  teamID?: T.Teams.TeamID
  visible: boolean
}

const InfoPanelMenuConnectorVisible = function InfoPanelMenuConnectorVisible(p: OwnProps) {
  const {visible} = p
  return visible ? <InfoPanelMenuConnector {...p} /> : null
}

const useData = (p: {isSmallTeam: boolean; pteamID: string | undefined}) => {
  const {isSmallTeam, pteamID} = p
  const username = useCurrentUserState(s => s.username)
  const infoMap = useUsersState(s => s.infoMap)
  const participantInfo = Chat.useChatContext(s => s.participants)
  const meta = Chat.useChatContext(s => s.meta)
  const teamMeta = Teams.useTeamsState(s => (pteamID ? Teams.getTeamMeta(s, pteamID) : undefined))
  const manageChannelsTitle = isSmallTeam ? 'Create channels...' : 'Browse all channels'
  const manageChannelsSubtitle = isSmallTeam ? 'Turns this into a big team' : ''

  const common = {
    badgeSubscribe: false,
    canAddPeople: false,
    channelname: '',
    fullname: undefined,
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

  if (meta.conversationIDKey !== Chat.noConversationIDKey) {
    const participants = Chat.getRowParticipants(participantInfo, username)
    // If it's a one-on-one chat, we need the user's fullname.
    const fullname =
      (participants.length === 1 && (infoMap.get(participants[0]!) || {fullname: ''}).fullname) || ''
    const {teamID, teamname, channelname, membershipType, status, isMuted, teamType} = meta
    const isInChannel = membershipType !== 'youArePreviewing'
    const ignored = status === T.RPCChat.ConversationStatus.ignored
    return {
      ...common,
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
    const teamname = teamMeta?.teamname ?? ''
    return {...common, teamID, teamname}
  }
  return {...common}
}

const InfoPanelMenuConnector = function InfoPanelMenuConnector(p: OwnProps) {
  const {attachTo, onHidden, floatingMenuContainerStyle, hasHeader} = p
  const {isSmallTeam, teamID: pteamID} = p
  const visible = true

  const data = useData({isSmallTeam, pteamID})
  const {teamname, teamID, channelname, isInChannel, ignored, fullname} = data
  const {manageChannelsSubtitle, manageChannelsTitle, participants, teamType, isMuted} = data

  const teamsState = Teams.useTeamsState(
    C.useShallow(s => ({
      addTeamWithChosenChannels: s.dispatch.addTeamWithChosenChannels,
      badgeSubscribe: !Teams.isTeamWithChosenChannels(s, teamname),
      canAddPeople: Teams.getCanPerformByID(s, teamID).manageMembers,
      manageChatChannels: s.dispatch.manageChatChannels,
      startAddMembersWizard: s.dispatch.startAddMembersWizard,
    }))
  )
  const {addTeamWithChosenChannels, badgeSubscribe, canAddPeople} = teamsState
  const {manageChatChannels, startAddMembersWizard} = teamsState
  const onAddPeople = () => {
    teamID && startAddMembersWizard(teamID)
  }
  const chatNavigateAppend = Chat.useChatNavigateAppend()
  const routerNavigateAppend = C.Router2.navigateAppend
  const onBlockConv = () => {
    chatNavigateAppend(conversationIDKey => ({
      name: 'chatBlockingModal',
      params: {
        blockUserByDefault: participants.length === 1,
        conversationIDKey,
        others: participants,
        team: teamname,
      },
    }))
  }

  const onJoinChannel = Chat.useChatContext(s => s.dispatch.joinConversation)
  const onLeaveChannel = Chat.useChatContext(s => s.dispatch.leaveConversation)
  const onLeaveTeam = () => teamID && chatNavigateAppend(() => ({name: 'teamReallyLeaveTeam', params: {teamID}}))
  const onManageChannels = () => {
    manageChatChannels(teamID)
    addTeamWithChosenChannels(teamID)
  }
  const clearModals = C.Router2.clearModals
  const markTeamAsRead = Chat.useChatContext(s => s.dispatch.markTeamAsRead)
  const onMarkAsRead = () => {
    clearModals()
    markTeamAsRead(teamID)
  }
  const setMarkAsUnread = Chat.useChatContext(s => s.dispatch.setMarkAsUnread)
  const onMarkAsUnread = () => {
    clearModals()
    setMarkAsUnread()
  }
  const onViewTeam = () => {
    clearModals()
    chatNavigateAppend(() => ({name: 'team', params: {teamID}}))
  }
  const hideConversation = Chat.useChatContext(s => s.dispatch.hideConversation)
  const onHideConv = () => {
    hideConversation(true)
  }
  const onMuteConv = Chat.useChatContext(s => s.dispatch.mute)
  const onUnhideConv = () => {
    hideConversation(false)
  }

  const isGeneralChannel = !!(channelname && channelname === 'general')
  const hasChannelSection = !isSmallTeam && !hasHeader
  const addPeopleItems = [
    {
      icon: 'iconfont-new',
      iconIsVisible: false,
      onClick: onAddPeople,
      title: hasChannelSection ? 'Add/Invite people to team' : 'Add/invite people',
    },
  ] as const

  const channelHeader = {
    title: 'channelHeader',
    unWrapped: true,
    view: (
      <Kb.Box2
        direction="horizontal"
        fullHeight={true}
        fullWidth={true}
        key="channelHeader"
        style={styles.channelHeader}
      >
        <Kb.Text lineClamp={1} type="Body" style={styles.channelName}>
          # <Kb.Text type="BodyBold">{channelname}</Kb.Text>
        </Kb.Text>
      </Kb.Box2>
    ),
  } as const
  const channelItem = isSmallTeam
    ? ({
        icon: 'iconfont-hash',
        iconIsVisible: false,
        onClick: onManageChannels,
        subTitle: manageChannelsSubtitle,
        title: manageChannelsTitle,
      } as const)
    : ({
        icon: 'iconfont-hash',
        iconIsVisible: false,
        isBadged: badgeSubscribe,
        onClick: onManageChannels,
        title: manageChannelsTitle,
      } as const)
  const teamHeader = {
    title: 'teamHeader',
    unWrapped: true,
    view: (
      <Kb.Box2
        direction="horizontal"
        fullHeight={true}
        fullWidth={true}
        key="teamHeader"
        style={Kb.Styles.collapseStyles([styles.channelHeader, styles.teamHeader])}
      >
        <Kb.Box2 direction="horizontal" gap="tiny">
          <Kb.Avatar teamname={teamname} size={16} />
          <Kb.Text type="BodyBold">{teamname}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    ),
  } as const

  const conversationIDKey = Chat.useChatContext(s => s.id)
  const hideItem = (() => {
    if (!conversationIDKey) {
      return null
    }
    if (teamType === 'adhoc' || teamType === 'small') {
      if (ignored) {
        return {
          icon: 'iconfont-unhide',
          iconIsVisible: false,
          onClick: onUnhideConv,
          style: {borderTopWidth: 0},
          title: 'Unhide conversation',
        } as const
      } else {
        return {
          icon: 'iconfont-hide',
          iconIsVisible: false,
          onClick: onHideConv,
          style: {borderTopWidth: 0},
          title: 'Hide until next message',
        } as const
      }
    } else {
      return null
    }
  })()

  const muteItem = (() => {
    if (!conversationIDKey || !isInChannel) {
      return null
    }
    const title = isMuted ? 'Unmute' : 'Mute'
    return {
      icon: 'iconfont-shh',
      iconIsVisible: false,
      onClick: () => onMuteConv(!isMuted),
      title,
    } as const
  })()
  const markAsUnread = (() => {
    if (!conversationIDKey) {
      return null
    }
    return {
      icon: 'iconfont-envelope-solid',
      iconIsVisible: false,
      onClick: onMarkAsUnread,
      title: 'Mark as unread',
    } as const
  })()

  const isAdhoc = (isSmallTeam && !conversationIDKey) || !!(teamType === 'adhoc')
  const onArchive = () => {
    if (isAdhoc && conversationIDKey) {
      routerNavigateAppend({
        name: 'archiveModal',
        params: {conversationIDKey, type: 'chatID' as const},
      })
    } else if (teamname) {
      routerNavigateAppend({
        name: 'archiveModal',
        params: {teamname, type: 'chatTeam' as const},
      })
    }
  }

  const items: Kb.MenuItems = []
  if (isAdhoc) {
    if (markAsUnread) {
      items.push(markAsUnread)
    }
    if (muteItem) {
      items.push(muteItem)
    }
    if (hideItem) {
      items.push(hideItem)
    }
    items.push({
      danger: true,
      icon: 'iconfont-user-block',
      iconIsVisible: false,
      onClick: onBlockConv,
      title: 'Block',
    } as const)
    conversationIDKey &&
      items.push({
        icon: 'iconfont-folder-downloads',
        iconIsVisible: false,
        onClick: onArchive,
        title: 'Backup conversation',
      } as const)
  } else {
    if (hasChannelSection) {
      items.push(channelHeader)
    }
    if (markAsUnread) {
      items.push(markAsUnread)
    }
    if (muteItem) {
      items.push(muteItem)
    }
    if (hideItem) {
      items.push(hideItem)
    }
    if (!isSmallTeam && !isInChannel && !isGeneralChannel && !hasHeader) {
      items.push({
        icon: 'iconfont-hash',
        iconIsVisible: false,
        onClick: onJoinChannel,
        title: 'Join channel',
      } as const)
    }
    if (!isSmallTeam && isInChannel && !isGeneralChannel && !hasHeader) {
      items.push({
        icon: 'iconfont-leave',
        iconIsVisible: false,
        onClick: () => onLeaveChannel(),
        title: 'Leave channel',
      } as const)
    }
    if (hasChannelSection) {
      items.push(teamHeader)
    }
    if (!isSmallTeam) {
      // Only show if we have multiple channels
      items.push({
        icon: 'iconfont-envelope',
        iconIsVisible: false,
        onClick: onMarkAsRead,
        title: 'Mark all as read',
      } as const)
    }
    items.push(channelItem, {
      icon: 'iconfont-info',
      iconIsVisible: false,
      onClick: onViewTeam,
      title: 'Team info',
    } as const)
    if (canAddPeople) {
      addPeopleItems.forEach(item => items.push(item))
    }
    items.push({
      icon: 'iconfont-team-leave',
      iconIsVisible: false,
      onClick: onLeaveTeam,
      title: 'Leave team',
    } as const)
    items.push({
      icon: 'iconfont-folder-downloads',
      iconIsVisible: false,
      onClick: onArchive,
      title: 'Backup conversation',
    } as const)
  }

  const header = hasHeader ? (
    isAdhoc && conversationIDKey ? (
      <AdhocHeader isMuted={!!isMuted} fullname={fullname ?? ''} />
    ) : teamname && teamID ? (
      <TeamHeader isMuted={!!isMuted} teamname={teamname} teamID={teamID} onViewTeam={onViewTeam} />
    ) : null
  ) : null

  return (
    <>
      <TeamsSubscriberMountOnly />
      <Kb.FloatingMenu
        attachTo={attachTo}
        containerStyle={floatingMenuContainerStyle}
        visible={visible}
        items={items}
        header={header}
        onHidden={onHidden}
        position="bottom left"
        closeOnSelect={true}
      />
    </>
  )
}

type AdhocHeaderProps = {
  fullname: string
  isMuted: boolean
}

const AdhocHeader = (props: AdhocHeaderProps) => {
  const meta = Chat.useChatContext(s => s.meta)
  const participants = Chat.useChatContext(s => s.participants)
  const {channelHumans} = InfoPanelCommon.useHumans(participants, meta)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
      <Avatars
        backgroundColor={Kb.Styles.globalColors.white}
        isMuted={props.isMuted}
        participantOne={channelHumans[0]}
        participantTwo={channelHumans[1]}
        singleSize={Kb.Styles.isMobile ? 48 : 32}
      />
      <Kb.Box2 alignItems="flex-start" direction="vertical">
        <Kb.ConnectedUsernames
          colorFollowing={true}
          commaColor={Kb.Styles.globalColors.black_50}
          inline={false}
          skipSelf={channelHumans.length > 1}
          containerStyle={styles.maybeLongText}
          type="BodyBold"
          underline={false}
          usernames={channelHumans}
          onUsernameClicked="profile"
        />
        {!!props.fullname && <Kb.Text type="BodySmall">{props.fullname}</Kb.Text>}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type TeamHeaderProps = {
  isMuted: boolean
  teamname: string
  teamID: T.Teams.TeamID
  onViewTeam: () => void
}
const TeamHeader = (props: TeamHeaderProps) => {
  // TODO: revert this back to memberCount if we can get one without bots cheaply.
  const {teamHumanCount} = InfoPanelCommon.useTeamHumans(props.teamID)
  return (
    <Kb.Box2 alignItems="center" direction="horizontal" style={styles.headerContainer}>
      <TeamAvatar
        teamname={props.teamname}
        isMuted={props.isMuted}
        isSelected={false}
        isHovered={false}
        size={32}
      />
      <Kb.Text type="BodySemibold" style={styles.maybeLongText} onClick={props.onViewTeam}>
        {props.teamname}
      </Kb.Text>
      <Kb.BoxGrow2 />
      {teamHumanCount ? (
        <Kb.Meta
          style={{alignSelf: 'center'}}
          backgroundColor={Kb.Styles.globalColors.blueGrey}
          color={Kb.Styles.globalColors.black_50}
          icon="iconfont-people-solid"
          iconColor={Kb.Styles.globalColors.black_20}
          title={teamHumanCount}
        />
      ) : (
        <Kb.ProgressIndicator type="Small" />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      channelHeader: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGreyLight,
          justifyContent: 'space-between',
        },
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          marginTop: -Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.medium),
        },
      }),
      channelName: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      headerContainer: Kb.Styles.platformStyles({
        common: {
          borderBottomColor: Kb.Styles.globalColors.black_10,
          borderBottomWidth: 1,
          borderStyle: 'solid',
        },
        isElectron: {
          ...Kb.Styles.padding(
            Kb.Styles.globalMargins.small,
            Kb.Styles.globalMargins.small,
            Kb.Styles.globalMargins.xsmall
          ),
          width: '100%', // don't expand if text is long
        },
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.medium),
          height: 64,
        },
      }),
      maybeLongText: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-word',
        } as const,
      }),
      teamHeader: {
        borderStyle: 'solid',
        borderTopColor: Kb.Styles.globalColors.black_10,
        borderTopWidth: 1,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default InfoPanelMenuConnectorVisible
