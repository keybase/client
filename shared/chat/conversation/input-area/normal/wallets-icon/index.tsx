import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type WalletsIconProps = {
  isNew: boolean
  onSend: () => void
  onRequest: () => void
  size: number
  style?: Styles.StylesCrossPlatform
}
const WalletsIcon = (props: WalletsIconProps & Kb.OverlayParentProps) => (
  <Kb.Box2
    ref={props.setAttachmentRef}
    direction="horizontal"
    style={Styles.collapseStyles([styles.container, props.style])}
  >
    <Kb.Icon type="iconfont-dollar-sign" fontSize={props.size} onClick={props.toggleShowingMenu} />
    {props.isNew && <Kb.Box style={styles.newBadge} />}
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={props.getAttachmentRef}
      items={[
        {
          newTag: props.isNew,
          onClick: props.onSend,
          title: 'Send Lumens (XLM)',
        },
        {
          newTag: props.isNew,
          onClick: props.onRequest,
          title: 'Request Lumens (XLM)',
        },
      ]}
      onHidden={props.toggleShowingMenu}
      position="top right"
      visible={props.showingMenu}
    />
  </Kb.Box2>
)

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
