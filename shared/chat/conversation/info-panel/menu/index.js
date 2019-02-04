// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {
  attachTo: () => ?React.Component<any>,
  badgeSubscribe: boolean,
  canAddPeople: boolean,
  isSmallTeam: boolean,
  manageChannelsSubtitle: string,
  manageChannelsTitle: string,
  memberCount: number,
  teamname: string,
  visible: boolean,
  hasCanPerform: boolean,
  loadOperations: () => void,
  onAddPeople: () => void,
  onHidden: () => void,
  onInvite: () => void,
  onLeaveTeam: () => void,
  onManageChannels: () => void,
  onViewTeam: () => void,
}

const Header = ({teamname, memberCount}: {teamname: string, memberCount: number}) => (
  <Kb.Box style={styles.headerContainer}>
    <Kb.Avatar
      size={Styles.isMobile ? 64 : 48}
      teamname={teamname}
      style={Kb.avatarCastPlatformStyles(styles.headerAvatar)}
    />
    <Kb.Text type="BodySemibold">{teamname}</Kb.Text>
    <Kb.Text type="BodySmall">{`${memberCount} member${memberCount !== 1 ? 's' : ''}`}</Kb.Text>
  </Kb.Box>
)

class InfoPanelMenu extends React.Component<Props> {
  componentDidDUpdate(prevProps: Props) {
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

    const items = [
      ...(props.canAddPeople ? addPeopleItems : []),
      {onClick: props.onViewTeam, style: {borderTopWidth: 0}, title: 'View team'},
      channelItem,
      {danger: true, onClick: props.onLeaveTeam, title: 'Leave team'},
    ]

    const header = {
      title: 'header',
      view: <Header teamname={props.teamname} memberCount={props.memberCount} />,
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
    },
    isMobile: {paddingBottom: 24, paddingTop: 40},
  }),
  noTopborder: {
    borderTopWidth: 0,
  },
  text: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blue,
    },
  }),
})

export {InfoPanelMenu}
