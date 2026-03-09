import type * as React from 'react'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {StylesCrossPlatform} from '@/styles/css'

export type PopupProps = {
  children: React.ReactNode
  onHidden: () => void

  // Desktop: if attachTo -> positioned popup near trigger; else -> centered dialog with overlay
  attachTo?: React.RefObject<MeasureRef | null>
  position?: Position
  positionFallbacks?: ReadonlyArray<Position>
  propagateOutsideClicks?: boolean
  matchDimension?: boolean
  remeasureHint?: number
  offset?: number
  style?: StylesCrossPlatform
  visible?: boolean

  // Mobile: always BottomSheet
  snapPoints?: Array<string | number>
}

declare const Popup: (p: PopupProps) => React.ReactNode
export default Popup
