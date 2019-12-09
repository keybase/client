import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import {Avatars, TeamAvatar} from '../../../avatars'

export type ConvProps = {
  fullname: string
  teamType: ChatTypes.TeamType
  teamname: string
  teamID: TeamTypes.TeamID
  ignored: boolean
  muted: boolean
  participants: Array<string>
}

export type Props = {
  attachTo?: () => React.Component<any> | null
  badgeSubscribe: boolean
  canAddPeople: boolean
  convProps?: ConvProps
  isSmallTeam: boolean
  manageChannelsSubtitle: string
  manageChannelsTitle: string
  memberCount: number
  teamname?: string
  visible: boolean
  onAddPeople: () => void
  onBlockConv: () => void
  onHidden: () => void
  onInvite: () => void
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
  participants: Array<string>
}

const AdhocHeader = (props: AdhocHeaderProps) => (
  <Kb.Box2 direction="vertical" gap="tiny" gapStart={false} gapEnd={true} style={styles.headerContainer}>
    <Avatars
      backgroundColor={Styles.globalColors.white}
      isHovered={false}
      isLocked={false}
      isMuted={props.isMuted}
      isSelected={false}
      participants={props.participants}
    />
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.ConnectedUsernames
        colorFollowing={true}
        commaColor={Styles.globalColors.black_50}
        inline={false}
        skipSelf={props.participants.length > 1}
        containerStyle={Styles.collapseStyles([styles.maybeLongText, styles.adhocUsernames])}
        type="BodyBig"
        underline={false}
        usernames={props.participants}
        onUsernameClicked="profile"
      />
      {!!props.fullname && <Kb.Text type="BodySmall">{props.fullname}</Kb.Text>}
    </Kb.Box2>
  </Kb.Box2>
)

type TeamHeaderProps = {
  isMuted: boolean
  memberCount: number
  teamname: string
  onViewTeam: () => void
}
const TeamHeader = (props: TeamHeaderProps) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={false} gapEnd={true} style={styles.headerContainer}>
      <TeamAvatar teamname={props.teamname} isMuted={props.isMuted} isSelected={false} isHovered={false} />
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodySemibold" style={styles.maybeLongText} onClick={props.onViewTeam}>
          {props.teamname}
        </Kb.Text>
        <Kb.Text type="BodySmall">{`${props.memberCount} member${
          props.memberCount !== 1 ? 's' : ''
        }`}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

class InfoPanelMenu extends React.Component<Props> {
  render() {
    const props = this.props
    const addPeopleItems = [
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
    const channelItem = props.isSmallTeam
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

    const isAdhoc = !!(props.convProps && props.convProps.teamType === 'adhoc')
    const items: Kb.MenuItems = (isAdhoc
      ? [this.hideItem(), this.muteItem(), {danger: true, onClick: props.onBlockConv, title: 'Block'}]
      : [
          ...(props.canAddPeople ? addPeopleItems : []),
          {
            icon: 'iconfont-people',
            onClick: props.onViewTeam,
            style: {borderTopWidth: 0},
            title: 'View team',
          },
          this.hideItem(),
          this.muteItem(),
          channelItem,
          {danger: true, icon: 'iconfont-leave', onClick: props.onLeaveTeam, title: 'Leave team'},
          {danger: true, icon: 'iconfont-remove', onClick: props.onBlockConv, title: 'Block team'},
        ]).reduce<Kb.MenuItems>((arr, i) => {
          i && arr.push(i as Kb.MenuItem)
          return arr
        }, [])

    const header = {
      title: 'header',
      view:
        isAdhoc && props.convProps ? (
          <AdhocHeader
            isMuted={props.convProps.muted}
            fullname={props.convProps.fullname}
            participants={props.convProps.participants}
          />
        ) : props.teamname ? (
          <TeamHeader
            isMuted={
              props.convProps === null || props.convProps === undefined ? false : props.convProps.muted
            }
            teamname={props.teamname}
            memberCount={props.memberCount}
            onViewTeam={props.onViewTeam}
          />
        ) : null,
    }

    return (
      <Kb.FloatingMenu
        attachTo={props.attachTo}
        visible={props.visible}
        items={items}
        header={header}
        onHidden={props.onHidden}
        position="bottom left"
        closeOnSelect={true}
      />
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
          subTitle: 'Until next message',
          title: 'Hide conversation',
        }
      }
    } else {
      return null
    }
  }

  muteItem() {
    if (this.props.convProps == null) {
      return null
    }
    const convProps = this.props.convProps
    const title = `${convProps.muted ? 'Unmute' : 'Mute all'} notifications`
    return {
      icon: 'iconfont-shh',
      onClick: () => this.props.onMuteConv(!convProps.muted),
      title,
    }
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      adhocUsernames: {
        justifyContent: 'center',
      },
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
      headerAvatar: Styles.platformStyles({
        isElectron: {
          marginBottom: 2,
        },
        isMobile: {
          marginBottom: 4,
        },
      }),
      headerContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
        },
        isElectron: {
          paddingTop: 16,
          width: 200, // don't expand if text is long
        },
        isMobile: {paddingBottom: 24, paddingTop: 40},
      }),
      maybeLongText: Styles.platformStyles({
        common: {
          ...Styles.padding(0, Styles.globalMargins.tiny),
          textAlign: 'center',
        },
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
      text: Styles.platformStyles({
        isMobile: {
          color: Styles.globalColors.blueDark,
        },
      }),
    } as const)
)

export {InfoPanelMenu}
