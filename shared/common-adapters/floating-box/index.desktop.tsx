import * as React from 'react'
import type {Props} from '.'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import type {MeasureDesktop} from '@/common-adapters/measure-ref'
import noop from 'lodash/noop'

const FloatingBox = (props: Props) => {
  const {attachTo} = props

  const getTargetRect = React.useCallback(() => {
    return attachTo?.current?.measure?.()
  }, [attachTo])
  const [targetRect, setTargetRect] = React.useState<MeasureDesktop | undefined>(getTargetRect())

  React.useEffect(() => {
    const tr = getTargetRect()
    setTargetRect(t => {
      if (t === tr) {
        return
      }
      if (!t || !tr) {
        return tr
      }
      if (t.left !== tr.left || t.top !== tr.top || t.width !== tr.width || t.height !== tr.height) {
        return tr
      }
      return
    })
  }, [getTargetRect])

  console.log('aaa floatinbox render', {targetRect})

  return (
    <RelativeFloatingBox
      disableEscapeKey={props.disableEscapeKey}
      position={props.position || 'bottom center'}
      positionFallbacks={props.positionFallbacks}
      targetRect={targetRect}
      matchDimension={!!props.matchDimension}
      onClosePopup={props.onHidden || noop}
      remeasureHint={props.remeasureHint}
      propagateOutsideClicks={props.propagateOutsideClicks}
      style={props.containerStyle}
    >
      {props.children}
    </RelativeFloatingBox>
  )
}

export default FloatingBox
