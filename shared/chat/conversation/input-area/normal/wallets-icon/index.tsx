import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type WalletsIconProps = {
  isNew: boolean
  loadWalletsData: () => void
  onSend: () => void
  onRequest: () => void
  size: number
  style?: Styles.StylesCrossPlatform
}
class WalletsIcon extends React.Component<WalletsIconProps & Kb.OverlayParentProps, {}> {
  componentDidMount() {
    // Load the wallet data at mount so we can determine the account ID of the default wallet
    this.props.loadWalletsData()
  }

  render() {
    return (
      <Kb.Box2
        ref={this.props.setAttachmentRef}
        direction="horizontal"
        style={Styles.collapseStyles([styles.container, this.props.style])}
      >
        <Kb.Icon
          type="iconfont-dollar-sign"
          fontSize={this.props.size}
          onClick={this.props.toggleShowingMenu}
        />
        {this.props.isNew && <Kb.Box style={styles.newBadge} />}
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={this.props.getAttachmentRef}
          items={[
            {
              newTag: this.props.isNew,
              onClick: this.props.onSend,
              title: 'Send Lumens (XLM)',
            },
            {
              newTag: this.props.isNew,
              onClick: this.props.onRequest,
              title: 'Request Lumens (XLM)',
            },
          ]}
          onHidden={this.props.toggleShowingMenu}
          position="top right"
          visible={this.props.showingMenu}
        />
      </Kb.Box2>
    )
  }
}

const radius = 4
const styles = Styles.styleSheetCreate({
  badge: Styles.platformStyles({
    common: {
      alignSelf: 'center',
    },
    isMobile: {
      position: 'absolute',
      right: 0,
      top: 2,
    },
  }),
  container: {
    position: 'relative',
  },
  menuItemBox: Styles.platformStyles({
    common: {
      alignItems: 'center',
    },
    isElectron: {
      justifyContent: 'space-between',
    },
    isMobile: {
      justifyContent: 'center',
    },
  }),
  newBadge: {
    backgroundColor: Styles.globalColors.blue,
    borderColor: Styles.globalColors.white,
    borderRadius: radius,
    borderStyle: 'solid',
    borderWidth: 1,
    height: radius * 2,
    position: 'absolute',
    right: -1,
    top: -2,
    width: radius * 2,
  },
  text: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blueDark,
    },
  }),
})

export default Kb.OverlayParentHOC(WalletsIcon)
