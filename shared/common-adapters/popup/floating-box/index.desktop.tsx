import noop from 'lodash/noop'
import type {Props} from './index.shared'
import {RelativeFloatingBox} from './relative-floating-box.desktop'

const DesktopFloatingBox = (props: Props) => {
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, propagateOutsideClicks, containerStyle, matchDimension} = props

  return (
    <RelativeFloatingBox
      attachTo={attachTo}
      // with nothing to call on Escape, a popup like a tooltip must not take it from what is under it
      disableEscapeKey={disableEscapeKey || !onHidden}
      position={position || 'bottom center'}
      positionFallbacks={positionFallbacks}
      matchDimension={!!matchDimension}
      onClosePopup={onHidden || noop}
      propagateOutsideClicks={propagateOutsideClicks}
      style={containerStyle}
      offset={offset}
    >
      {children}
    </RelativeFloatingBox>
  )
}

export default DesktopFloatingBox
