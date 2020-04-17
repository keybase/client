import * as React from 'react'
import {Props} from './toast'
import FloatingBox from './floating-box'
import * as Styles from '../styles'

const Kb = {
  FloatingBox,
}

const FadeBox = Styles.styled.div(() => ({
  ...Styles.transition('opacity'),
  '&.active': {opacity: 1},
  '&.visible': {display: 'flex', opacity: 1},
  opacity: 0,
}))

const Toast = (props: Props) => (
  <Kb.FloatingBox attachTo={props.attachTo} propagateOutsideClicks={true} position={props.position}>
    <FadeBox
      className={Styles.classNames({visible: props.visible}, props.className)}
      style={Styles.collapseStyles([styles.container, props.containerStyle])}
    >
      {props.children}
    </FadeBox>
  </Kb.FloatingBox>
)
export default Toast

const styles = Styles.styleSheetCreate(() => ({
  container: {
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
  },
}))
