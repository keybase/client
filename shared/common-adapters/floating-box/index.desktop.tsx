import * as React from 'react'
import type {Props} from '.'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import type {MeasureDesktop} from '@/common-adapters/measure-ref'
import noop from 'lodash/noop'
import shallowEqual from 'shallowequal'

const FloatingBox = (props: Props) => {
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, remeasureHint, propagateOutsideClicks, containerStyle, matchDimension} = props

  const cur = attachTo?.current

  const [targetRect, setTargetRect] = React.useState<MeasureDesktop | undefined>(cur?.measure?.())

  React.useEffect(() => {
    const tr = cur?.measure?.()

    setTargetRect(t => {
      if (t === tr) {
        return t
      }
      if (!t || !tr) {
        return t || tr
      }
      if (shallowEqual(t, tr)) {
        return t
      }
      return tr
    })
  }, [cur])

  return (
    <RelativeFloatingBox
      disableEscapeKey={disableEscapeKey}
      position={position || 'bottom center'}
      positionFallbacks={positionFallbacks}
      targetRect={targetRect}
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
