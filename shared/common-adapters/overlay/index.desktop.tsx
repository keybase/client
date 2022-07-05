import * as React from 'react'
import {Box2, FloatingBox} from '..'
import {Props} from '.'
import * as Styles from '../../styles'

const Overlay = (props: Props) => {
  if (Object.prototype.hasOwnProperty.call(props, 'visible') && !props.visible) {
    return null
  }
  return (
    <FloatingBox
      attachTo={props.attachTo}
      matchDimension={!!props.matchDimension}
      onHidden={props.onHidden}
      remeasureHint={props.remeasureHint}
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      <Box2 direction="vertical" style={Styles.collapseStyles([styles.innerContainer, props.style])}>
        {props.children}
      </Box2>
    </FloatingBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  innerContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: 3,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
}))

export default Overlay
