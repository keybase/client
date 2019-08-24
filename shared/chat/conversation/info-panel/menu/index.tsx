import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatTypes from '../../../../constants/types/chat2'
import {Avatars, TeamAvatar} from '../../../avatars'

export type ConvProps = {
  fullname: string
  teamType: ChatTypes.TeamType
  ignored: boolean
  muted: boolean
  participants: Array<string>
}

export type Props = {
  attachTo?: () => React.Component<any> | null
  badgeSubscribe: boolean
  canAddPeople: boolean
  convProps: ConvProps | null
  isSmallTeam: boolean
  manageChannelsSubtitle: string
  manageChannelsTitle: string
  memberCount: number
  teamname?: string
  visible: boolean
  hasCanPerform: boolean
  loadOperations: () => void
  onAddPeople: () => void
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
        containerStyle={styles.maybeLongText}
        type="BodyBig"
        underline={false}
        usernames={props.participants}
      />
      {!!props.fullname && <Kb.Text type="BodySmall">{props.fullname}</Kb.Text>}
    </Kb.Box2>
  </Kb.Box2>
)

type TeamHeaderProps = {
  isMuted: boolean
  memberCount: number
  teamname: string
}
const TeamHeader = (props: TeamHeaderProps) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={false} gapEnd={true} style={styles.headerContainer}>
      <TeamAvatar teamname={props.teamname} isMuted={props.isMuted} isSelected={false} isHovered={false} />
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodySemibold" style={styles.maybeLongText}>
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
  componentDidUpdate(prevProps: Props) {
    if (this.props.hasCanPerform && this.props.visible !== prevProps.visible) {
      this.props.loadOperations()
    }
  }

  render() {
    const props = this.props
    const addPeopleItems = [
      {
        onClick: props.onAddPeople,
        style: {borderTopWidth: 0},
        subTitle: 'Keybase, Twitter, etc.',
        title: 'Add someone by username',
      },
      {
        onClick: props.onInvite,
        title: Styles.isMobile ? 'Add someone from address book' : 'Add someone by email',
      },
    ]
    const channelItem = props.isSmallTeam
      ? {
          onClick: props.onManageChannels,
          subTitle: props.manageChannelsSubtitle,
          title: props.manageChannelsTitle,
        }
      : {
          onClick: props.onManageChannels,
          title: props.manageChannelsTitle,
          view: (
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text style={styles.text} type={Styles.isMobile ? 'BodyBig' : 'Body'}>
                {props.manageChannelsTitle}
              </Kb.Text>
              {props.badgeSubscribe && <Kb.Box style={styles.badge} />}
            </Kb.Box>
          ),
        }

    const isAdhoc = !!(props.convProps && props.convProps.teamType === 'adhoc')
    const adhocItems = [this.hideItem(), this.muteItem()]
    const teamItems = [
      ...(props.canAddPeople ? addPeopleItems : []),
      {onClick: props.onViewTeam, style: {borderTopWidth: 0}, title: 'View team'},
      this.hideItem(),
      this.muteItem(),
      channelItem,
      {danger: true, onClick: props.onLeaveTeam, title: 'Leave team'},
    ].filter(item => item !== null)

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
          />
        ) : null,
    }

    return (
      <Kb.FloatingMenu
        attachTo={props.attachTo}
        visible={props.visible}
        items={isAdhoc ? adhocItems : teamItems}
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
        return {onClick: this.props.onUnhideConv, style: {borderTopWidth: 0}, title: 'Unhide conversation'}
      } else {
        return {
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
      onClick: () => this.props.onMuteConv(!convProps.muted),
      title,
      view: (
        <Kb.Box style={styles.muteAction}>
          <Kb.Text style={styles.text} type={Styles.isMobile ? 'BodyBig' : 'Body'}>
            {title}
          </Kb.Text>
          {!convProps.muted && (
            <Kb.Icon color={Styles.globalColors.black_20} style={styles.icon} type="iconfont-shh" />
          )}
        </Kb.Box>
      ),
    }
  }
}

const styles = Styles.styleSheetCreate({
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
  icon: {
    marginLeft: Styles.globalMargins.tiny,
  },
  maybeLongText: Styles.platformStyles({
    common: {
      ...Styles.padding(0, Styles.globalMargins.tiny),
      textAlign: 'center',
    },
    isElectron: {
      wordBreak: 'break-word',
    },
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
})

export {InfoPanelMenu}
