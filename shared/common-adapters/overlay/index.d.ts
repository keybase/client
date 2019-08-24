import * as React from 'react'
import {Position} from '../relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../styles/css'

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
  attachTo?: () => React.Component<any> | null
  // Mobile only - select which GatewayDest to use. Default is 'popup-root'
  dest?: 'popup-root' | 'keyboard-avoiding-root'
  children: React.ReactNode
  color?: string
  matchDimension?: boolean
  onHidden: () => void
  position?: Position
  positionFallbacks?: Position[]
  propagateOutsideClicks?: boolean
  style?: StylesCrossPlatform
  visible?: boolean
}

export default class extends React.Component<Props> {}
