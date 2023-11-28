import type * as React from 'react'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {StylesCrossPlatform} from '@/styles/css'

/**
 * Overlay is the generic form of
 *  - Desktop: floating box staying near box below
 *  - Mobile: sheet appearing at bottom of the screen
 * Both have handlers to hide themselves when the user presses
 * outside of the bounding box. They also include basic styling
 * of the overlay e.g. filling container absolutely and a translucent
 * bg color on native. The desktop styling includes rounded corners and
 * box-shadow. It can also be extended in the future to include a hide
 * / show animation.
 */

export type Props = {
  attachTo?: React.RefObject<MeasureRef>
  children: React.ReactNode
  color?: string
  matchDimension?: boolean
  onHidden: () => void
  position?: Position
  positionFallbacks?: ReadonlyArray<Position>
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  style?: StylesCrossPlatform
  visible?: boolean
}

declare const Overlay: (p: Props) => React.ReactNode
export default Overlay
