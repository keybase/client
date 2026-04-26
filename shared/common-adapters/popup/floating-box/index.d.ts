import type * as React from 'react'
import type {StylesCrossPlatform} from '@/styles/css'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'

// GatewayDests:
// popup-root: At the root of the app. Sibling to root route renderer.

export type Props = {
  children?: React.ReactNode | undefined
  // Desktop only - will be triggered automatically only on click outside the box
  onHidden?: (() => void) | undefined
  // Desktop only - the node that we should aim for
  // optional because desktop only, return val nullable because refs always are
  attachTo?: React.RefObject<MeasureRef | null> | undefined
  // Desktop only - allow clicks outside the floating box to propagate. On
  disableEscapeKey?: boolean | undefined // if true, ignore keys
  // mobile you can control this by setting a margin in `containerStyle`.
  propagateOutsideClicks?: boolean | undefined
  containerStyle?: StylesCrossPlatform | undefined
  matchDimension?: boolean | undefined
  remeasureHint?: number | undefined
  position?: Position | undefined
  positionFallbacks?: ReadonlyArray<Position> | undefined
  hideKeyboard?: boolean | undefined // if true, hide the keyboard on mount
  offset?: number | undefined
}
export declare const FloatingBox: (p: Props) => React.ReactNode
export default FloatingBox
