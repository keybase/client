import type {Props} from './toast'
import Popup from './popup'
import * as Styles from '@/styles'
import './toast.css'

const positionFallbacks = [] as const

const Toast = (props: Props) => (
  <Popup
    attachTo={props.attachTo}
    propagateOutsideClicks={true}
    position={props.position}
    containerStyle={styles.float}
    offset={4}
    positionFallbacks={positionFallbacks}
  >
    <div
      className={Styles.classNames({visible: props.visible}, props.className, 'fadeBox')}
      style={Styles.collapseStyles([styles.container, props.containerStyle]) as React.CSSProperties}
    >
      {props.children}
    </div>
  </Popup>
)
export default Toast

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black,
      borderRadius: Styles.borderRadius,
      borderWidth: 0,
      justifyContent: 'center',
      margin: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
      pointerEvents: 'none',
      position: 'relative',
    },
  }),
  float: Styles.platformStyles({
    isElectron: {pointerEvents: 'none'},
  }),
}))
