// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type WalletsIconProps = {|
  isNew: boolean,
  onSend: () => void,
  onRequest: () => void,
  size: number,
  style?: Styles.StylesCrossPlatform,
|}
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
          onClick: props.onSend,
          title: 'Send Lumens (XLM)',
          view: (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox} gap="small">
              <Kb.Text type="Body">Send Lumens (XLM)</Kb.Text>
              {props.isNew && (
                <Kb.Meta
                  title="New"
                  size="Small"
                  backgroundColor={Styles.globalColors.blue}
                  style={styles.badge}
                />
              )}
            </Kb.Box2>
          ),
        },
        {
          onClick: props.onRequest,
          title: 'Request Lumens (XLM)',
          view: (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox} gap="small">
              <Kb.Text type="Body">Request Lumens (XLM)</Kb.Text>
              {props.isNew && (
                <Kb.Meta
                  title="New"
                  size="Small"
                  backgroundColor={Styles.globalColors.blue}
                  style={styles.badge}
                />
              )}
            </Kb.Box2>
          ),
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
  container: {
    position: 'relative',
  },
  menuItemBox: {
    justifyContent: 'space-between',
  },
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
  badge: {
    alignSelf: 'center',
  },
})

export default Kb.OverlayParentHOC(WalletsIcon)
