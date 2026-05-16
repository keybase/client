import type * as React from 'react'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {StylesCrossPlatform} from '@/styles/css'

export type PopupProps = {
  children: React.ReactNode
  onHidden?: () => void

  // If attachTo -> positioned popup near trigger (desktop: FloatingBox, mobile: Portal)
  // If no attachTo + onHidden -> centered overlay (desktop) or BottomSheet (mobile)
  // If no attachTo + no onHidden -> Portal (mobile only, for rendering above nav stack)
  attachTo?: React.RefObject<MeasureRef | null>
  position?: Position
  positionFallbacks?: ReadonlyArray<Position>
  propagateOutsideClicks?: boolean
  matchDimension?: boolean
  remeasureHint?: number
  offset?: number
  style?: StylesCrossPlatform
  containerStyle?: StylesCrossPlatform
  visible?: boolean
  hideKeyboard?: boolean

  // Mobile only: BottomSheet snap points (only used when no attachTo)
  snapPoints?: Array<string | number>
}

declare const Popup: (p: PopupProps) => React.ReactNode
export default Popup
