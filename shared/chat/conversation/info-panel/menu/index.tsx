import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import * as InfoPanelCommon from '../common'
import {Avatars, TeamAvatar} from '../../../avatars'
import {TeamsSubscriberMountOnly} from '../../../../teams/subscriber'
import flags from '../../../../util/feature-flags'

export type ConvProps = {
  fullname: string
  teamType: ChatTypes.TeamType
  teamname: string
  teamID: TeamTypes.TeamID
  ignored: boolean
  muted: boolean
  conversationIDKey: ChatTypes.ConversationIDKey
}

export type Props = {
  attachTo?: () => React.Component<any> | null
  badgeSubscribe: boolean
  canAddPeople: boolean
  channelname?: string
  convProps?: ConvProps
  floatingMenuContainerStyle?: Styles.StylesCrossPlatform
  hasHeader: boolean
  isInChannel: boolean
  isSmallTeam: boolean
  manageChannelsSubtitle: string
  manageChannelsTitle: string
  teamname?: string
  teamID: TeamTypes.TeamID
  visible: boolean
  onAddPeople: () => void
  onBlockConv: () => void
  onHidden: () => void
  onInvite: () => void
  onJoinChannel: () => void
  onLeaveChannel: () => void
  onLeaveTeam: () => void
  onHideConv: () => void
  onMuteConv: (muted: boolean) => void
  onUnhideConv: () => void
  onManageChannels: () => void
  onViewTeam: () => void
}

type AdhocHeaderProps = {
  fullname: string
  isMuted: boolean
  conversationIDKey: ChatTypes.ConversationIDKey
}

const AdhocHeader = (props: AdhocHeaderProps) => {
  const {channelHumans} = InfoPanelCommon.useHumans(props.conversationIDKey)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerContainer}>
      <Avatars
        backgroundColor={Styles.globalColors.white}
        isHovered={false}
        isLocked={false}
        isMuted={props.isMuted}
        isSelected={false}
        participants={channelHumans}
        singleSize={Styles.isMobile ? 48 : 32}
      />
      <Kb.Box2 alignItems="flex-start" direction="vertical">
        <Kb.ConnectedUsernames
          colorFollowing={true}
          commaColor={Styles.globalColors.black_50}
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
  teamID: TeamTypes.TeamID
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
      <Kb.Box2 direction="horizontal" style={styles.teamText}>
        <Kb.Text type="BodySemibold" style={styles.maybeLongText} onClick={props.onViewTeam}>
          {props.teamname}
        </Kb.Text>
        {teamHumanCount ? (
          <Kb.Meta
            backgroundColor={Styles.globalColors.blueGrey}
            color={Styles.globalColors.black_50}
            icon="iconfont-people-solid"
            iconColor={Styles.globalColors.black_20}
            title={teamHumanCount}
          />
        ) : (
          <Kb.ProgressIndicator type="Small" />
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

class InfoPanelMenu extends React.Component<Props> {
  render() {
    const props = this.props
    const isGeneralChannel = !!(props.channelname && props.channelname === 'general')
    const hasChannelSection = !props.isSmallTeam && !props.hasHeader
    const addPeopleItems: Kb.MenuItems = flags.teamsRedesign
      ? [
          {
            icon: 'iconfont-new',
            onClick: props.onAddPeople,
            title: hasChannelSection ? 'Add/Invite people to team' : 'Add/invite people',
          },
        ]
      : [
          {
            icon: 'iconfont-mention',
            onClick: props.onAddPeople,
            style: {borderTopWidth: 0},
            subTitle: 'Keybase, Twitter, etc.',
            title: 'Add someone by username',
          },
          {
            icon: 'iconfont-contact-book',
            onClick: props.onInvite,
            title: Styles.isMobile ? 'Add someone from address book' : 'Add someone by email',
          },
        ]
    const channelHeader: Kb.MenuItem = {
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
            # <Kb.Text type="BodyBold">{props.channelname}</Kb.Text>
          </Kb.Text>
        </Kb.Box2>
      ),
    }
    const channelItem: Kb.MenuItem = props.isSmallTeam
      ? {
          icon: 'iconfont-hash',
          onClick: props.onManageChannels,
          subTitle: props.manageChannelsSubtitle,
          title: props.manageChannelsTitle,
        }
      : {
          icon: 'iconfont-hash',
          isBadged: props.badgeSubscribe,
          onClick: props.onManageChannels,
          title: props.manageChannelsTitle,
        }
    const teamHeader: Kb.MenuItem = {
      title: 'teamHeader',
      unWrapped: true,
      view: (
        <Kb.Box2
          direction="horizontal"
          fullHeight={true}
          fullWidth={true}
          key="teamHeader"
          style={Styles.collapseStyles([styles.channelHeader, styles.teamHeader])}
        >
          <Kb.Box2 direction="horizontal" gap="tiny">
            <Kb.Avatar teamname={props.teamname} size={16} />
            <Kb.Text type="BodyBold">{props.teamname}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      ),
    }

    const hideItem = this.hideItem()
    const muteItem = this.muteItem()

    const isAdhoc =
      (props.isSmallTeam && !props.convProps) || !!(props.convProps && props.convProps.teamType === 'adhoc')
    const items: Kb.MenuItems = []
    if (isAdhoc) {
      if (muteItem) {
        items.push(muteItem as Kb.MenuItem)
      }
      if (hideItem) {
        items.push(hideItem as Kb.MenuItem)
      }
      items.push({
        danger: true,
        icon: 'iconfont-user-block',
        onClick: props.onBlockConv,
        title: 'Block',
      })
    } else {
      if (hasChannelSection) {
        items.push(channelHeader)
      }
      if (muteItem) {
        items.push(muteItem as Kb.MenuItem)
      }
      if (hideItem) {
        items.push(hideItem as Kb.MenuItem)
      }
      if (!props.isSmallTeam && !props.isInChannel && !isGeneralChannel && !props.hasHeader) {
        items.push({icon: 'iconfont-hash', onClick: props.onJoinChannel, title: 'Join channel'})
      }
      if (!props.isSmallTeam && props.isInChannel && !isGeneralChannel && !props.hasHeader) {
        items.push({icon: 'iconfont-leave', onClick: props.onLeaveChannel, title: 'Leave channel'})
      }
      if (hasChannelSection) {
        items.push(teamHeader)
      }
      items.push(channelItem, {
        icon: 'iconfont-info',
        onClick: props.onViewTeam,
        title: 'Team info',
      })
      if (props.canAddPeople) {
        addPeopleItems.forEach(item => items.push(item))
      }
      items.push({icon: 'iconfont-team-leave', onClick: props.onLeaveTeam, title: 'Leave team'})
    }

    const header = props.hasHeader ? (
      isAdhoc && props.convProps ? (
        <AdhocHeader
          isMuted={props.convProps.muted}
          fullname={props.convProps.fullname}
          conversationIDKey={props.convProps.conversationIDKey}
        />
      ) : props.teamname ? (
        <TeamHeader
          isMuted={props.convProps === null || props.convProps === undefined ? false : props.convProps.muted}
          teamname={props.teamname}
          teamID={props.teamID}
          onViewTeam={props.onViewTeam}
        />
      ) : null
    ) : null

    return (
      <>
        {props.visible && <TeamsSubscriberMountOnly />}
        <Kb.FloatingMenu
          attachTo={props.attachTo}
          containerStyle={props.floatingMenuContainerStyle}
          visible={props.visible}
          items={items}
          header={header}
          onHidden={props.onHidden}
          position="bottom left"
          closeOnSelect={true}
        />
      </>
    )
  }

  hideItem() {
    if (this.props.convProps == null) {
      return null
    }
    const convProps = this.props.convProps
    if (convProps.teamType === 'adhoc' || convProps.teamType === 'small') {
      if (convProps.ignored) {
        return {
          icon: 'iconfont-unhide',
          onClick: this.props.onUnhideConv,
          style: {borderTopWidth: 0},
          title: 'Unhide conversation',
        }
      } else {
        return {
          icon: 'iconfont-hide',
          onClick: this.props.onHideConv,
          style: {borderTopWidth: 0},
          title: 'Hide until next message',
        }
      }
    } else {
      return null
    }
  }

  muteItem() {
    if (this.props.convProps == null || !this.props.isInChannel) {
      return null
    }
    const convProps = this.props.convProps
    const title = convProps.muted ? 'Unmute' : 'Mute'
    return {
      icon: 'iconfont-shh',
      iconIsVisible: true,
      onClick: () => this.props.onMuteConv(!convProps.muted),
      title,
    }
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blue,
          borderRadius: 6,
          height: 8,
          margin: 6,
          width: 8,
        },
        isElectron: {
          margin: 4,
          marginTop: 5,
          position: 'absolute',
          right: Styles.globalMargins.tiny,
        },
      }),
      channelHeader: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGreyLight,
          justifyContent: 'space-between',
        },
        isElectron: {
          ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
          marginTop: -Styles.globalMargins.tiny,
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.medium),
        },
      }),
      channelName: Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      headerContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.padding(
            Styles.globalMargins.small,
            Styles.globalMargins.small,
            Styles.globalMargins.xsmall
          ),
          width: '100%', // don't expand if text is long
        },
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium),
          height: 64,
        },
      }),
      maybeLongText: Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-word',
        } as const,
      }),
      muteAction: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      noTopborder: {
        borderTopWidth: 0,
      },
      teamHeader: {
        borderStyle: 'solid',
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        marginTop: Styles.globalMargins.tiny,
      },
      teamText: {
        flex: 1,
        justifyContent: 'space-between',
      },
      text: Styles.platformStyles({
        isMobile: {
          color: Styles.globalColors.blueDark,
        },
      }),
    } as const)
)

export {InfoPanelMenu}
