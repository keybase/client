import * as Styles from '@/styles'
import {Box2} from '../box'
import FloatingBox from './floating-box'
import type {AnchoredPopupProps} from './index.shared'
export type {AnchoredPopupProps} from './index.shared'

export const AnchoredPopup = (props: AnchoredPopupProps) => {
  const {attachTo, children, containerStyle, hideKeyboard, matchDimension, offset, onHidden} = props
  const {position, positionFallbacks, propagateOutsideClicks, remeasureHint, style} = props
  const styles = useStyles()

  if (isMobile) {
    // on mobile FloatingBox is the portal + keyboard-dismiss overlay this needs,
    // and there is no positioner, so the anchor and placement props go unused
    return (
      <FloatingBox containerStyle={containerStyle} hideKeyboard={hideKeyboard}>
        {children}
      </FloatingBox>
    )
  }

  return (
    <FloatingBox
      attachTo={attachTo}
      containerStyle={containerStyle}
      matchDimension={!!matchDimension}
      onHidden={onHidden}
      remeasureHint={remeasureHint}
      position={position}
      positionFallbacks={positionFallbacks}
      propagateOutsideClicks={propagateOutsideClicks}
      offset={offset}
    >
      {onHidden ? (
        <Box2 direction="vertical" style={Styles.collapseStyles([styles.positioned, style])}>
          {children}
        </Box2>
      ) : (
        children
      )}
    </FloatingBox>
  )
}

const useStyles = Styles.createStyleHook(() => ({
  positioned: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.rounded,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
}))

export default AnchoredPopup
