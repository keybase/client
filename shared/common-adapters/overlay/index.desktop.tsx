import {Box2} from '@/common-adapters/box'
import FloatingBox from '../floating-box'
import type {Props} from '.'
import * as Styles from '@/styles'

const Overlay = (props: Props) => {
  if (Object.hasOwn(props, 'visible') && !props.visible) {
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
