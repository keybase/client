// @flow
import * as React from 'react'
import type {Props} from './toast'
import FloatingBox from './floating-box'
import * as Styles from '../styles'

const FadeBox = Styles.glamorous.div({
  ...Styles.transition('opacity'),
  '&.visible': {
    opacity: 1,
  },
  '&.active': {
    opacity: 1,
  },
  opacity: 0,
})

export default (props: Props) => (
  <FloatingBox attachTo={props.attachTo} propagateOutsideClicks={true} position={props.position}>
    <FadeBox
      className={Styles.classNames({visible: props.visible})}
      style={Styles.collapseStyles([styles.container, props.containerStyle])}
    >
      {props.children}
    </FadeBox>
  </FloatingBox>
)

const styles = Styles.styleSheetCreate({
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black_75,
    borderRadius: Styles.borderRadius,
    borderWidth: 0,
    display: 'flex',
    justifyContent: 'center',
    margin: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
})
