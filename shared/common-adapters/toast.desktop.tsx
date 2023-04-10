import type {Props} from './toast'
import FloatingBox from './floating-box'
import * as Styles from '../styles'
import './toast.css'

const Kb = {
  FloatingBox,
}

const Toast = (props: Props) => (
  <Kb.FloatingBox attachTo={props.attachTo} propagateOutsideClicks={true} position={props.position}>
    <div
      className={Styles.classNames({visible: props.visible}, props.className, 'fadeBox')}
      style={Styles.collapseStyles([styles.container, props.containerStyle])}
    >
      {props.children}
    </div>
  </Kb.FloatingBox>
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
    },
  }),
}))
