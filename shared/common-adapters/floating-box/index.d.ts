import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles/css'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'

// GatewayDests:
// popup-root: At the root of the app. Sibling to root route renderer.

export type Props = {
  children?: React.ReactNode
  // Desktop only - will be triggered automatically only on click outside the box
  onHidden?: () => void
  // Desktop only - the node that we should aim for
  // optional because desktop only, return val nullable because refs always are
  attachTo?: React.RefObject<MeasureRef>
  // Desktop only - allow clicks outside the floating box to propagate. On
  disableEscapeKey?: boolean // if true, ignore keys
  // mobile you can control this by setting a margin in `containerStyle`.
  propagateOutsideClicks?: boolean
  containerStyle?: StylesCrossPlatform
  matchDimension?: boolean
  remeasureHint?: number
  position?: Position
  positionFallbacks?: ReadonlyArray<Position>
  hideKeyboard?: boolean // if true, hide the keyboard on mount
}
export declare const FloatingBox: (p: Props) => React.ReactNode
export default FloatingBox
