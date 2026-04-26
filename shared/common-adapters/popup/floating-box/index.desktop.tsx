import type {Props} from '.'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import noop from 'lodash/noop'

const FloatingBox = (props: Props) => {
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, remeasureHint, propagateOutsideClicks, containerStyle, matchDimension} = props

  return (
    <RelativeFloatingBox
      position={position || 'bottom center'}
      matchDimension={!!matchDimension}
      onClosePopup={onHidden || noop}
      {...(attachTo === undefined ? {} : {attachTo})}
      {...(disableEscapeKey === undefined ? {} : {disableEscapeKey})}
      {...(positionFallbacks === undefined ? {} : {positionFallbacks})}
      {...(remeasureHint === undefined ? {} : {remeasureHint})}
      {...(propagateOutsideClicks === undefined ? {} : {propagateOutsideClicks})}
      {...(containerStyle === undefined ? {} : {style: containerStyle})}
      {...(offset === undefined ? {} : {offset})}
    >
      {children}
    </RelativeFloatingBox>
  )
}

export default FloatingBox
