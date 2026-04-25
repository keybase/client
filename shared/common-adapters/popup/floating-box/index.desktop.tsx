import * as React from 'react'
import type {Props} from '.'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import noop from 'lodash/noop'

const FloatingBox = (props: Props) => {
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, remeasureHint, propagateOutsideClicks, containerStyle, matchDimension} = props

  return (
    <RelativeFloatingBox
      attachTo={attachTo}
      disableEscapeKey={disableEscapeKey}
      position={position || 'bottom center'}
      positionFallbacks={positionFallbacks}
      matchDimension={!!matchDimension}
      onClosePopup={onHidden || noop}
      remeasureHint={remeasureHint}
      propagateOutsideClicks={propagateOutsideClicks}
      style={containerStyle}
      offset={offset}
    >
      {children}
    </RelativeFloatingBox>
  )
}

export default FloatingBox
