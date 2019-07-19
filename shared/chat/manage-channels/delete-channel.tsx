import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const PopupHeader = ({channelName}: {channelName: string}) => {
  return (
    <Kb.Box style={styles.headerContainer}>
      <Kb.Text center={true} type="BodySemibold" style={styles.headerTextTop}>
        Are you sure you want to delete #{channelName}?
      </Kb.Text>
      <Kb.Text center={true} type="BodySmall" style={styles.headerTextBottom}>
        All messages will be lost. This cannot be undone.
      </Kb.Text>
    </Kb.Box>
  )
}

type Props = {
  channelName: string
  disabled: boolean
  onConfirmedDelete: () => void
} & Kb.OverlayParentProps

type State = {}

class _DeleteChannel extends React.Component<Props, State> {
  render() {
    const {disabled} = this.props

    const header = {
      title: 'header',
      view: <PopupHeader channelName={this.props.channelName} />,
    }

    const items = [
      'Divider' as const,
      {danger: true, onClick: this.props.onConfirmedDelete, title: 'Yes, delete channel'} as const,
      {title: 'Cancel'} as const,
    ]

    return (
      <Kb.Box style={Styles.collapseStyles([styles.container, disabled && {opacity: 0.5}])}>
        <Kb.Icon
          type="iconfont-trash"
          style={Kb.iconCastPlatformStyles(styles.trashIcon)}
          color={Styles.globalColors.red}
        />
        <Kb.FloatingMenu
          closeOnSelect={true}
          header={header}
          items={items}
          attachTo={this.props.getAttachmentRef}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
          containerStyle={styles.menuContainer}
        />
        <Kb.Text
          type={'BodyBigLink'}
          style={styles.colorRed}
          onClick={this.props.toggleShowingMenu}
          ref={this.props.setAttachmentRef}
        >
          Delete channel
        </Kb.Text>
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  colorRed: {color: Styles.globalColors.redDark},
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
    },
    isElectron: {
      left: 12,
      position: 'absolute',
      top: 55,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingLeft: Styles.globalMargins.large,
      paddingRight: Styles.globalMargins.large,
      paddingTop: Styles.globalMargins.medium,
    },
  }),
  headerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      width: '100%',
    },
    isElectron: {
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.large,
    },
  }),
  headerTextBottom: {color: Styles.globalColors.black_50},
  headerTextTop: {color: Styles.globalColors.black},
  menuContainer: {width: 196},
  trashIcon: {marginRight: Styles.globalMargins.tiny},
})

const DeleteChannel = Kb.OverlayParentHOC(_DeleteChannel)
export default DeleteChannel
