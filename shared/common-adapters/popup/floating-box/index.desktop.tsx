import type {MeasureRef} from '../../measure-ref'
import type * as Styles from '@/styles'
import type * as React from 'react'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import noop from 'lodash/noop'


export type Props = {
  children?: React.ReactNode
  onHidden?: () => void
  attachTo?: React.RefObject<MeasureRef | null>
  disableEscapeKey?: boolean
  propagateOutsideClicks?: boolean
  containerStyle?: Styles.StylesCrossPlatform
  matchDimension?: boolean
  remeasureHint?: number
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  hideKeyboard?: boolean
  offset?: number
}
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
