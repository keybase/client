import type * as React from 'react'
import type {Position} from '@/styles'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {StylesCrossPlatform} from '@/styles/css'

export type PopupProps = {
  children: React.ReactNode
  onHidden?: (() => void) | undefined

  // If attachTo -> positioned popup near trigger (desktop: FloatingBox, mobile: Portal)
  // If no attachTo + onHidden -> centered overlay (desktop) or BottomSheet (mobile)
  // If no attachTo + no onHidden -> Portal (mobile only, for rendering above nav stack)
  attachTo?: React.RefObject<MeasureRef | null> | undefined
  position?: Position | undefined
  positionFallbacks?: ReadonlyArray<Position> | undefined
  propagateOutsideClicks?: boolean | undefined
  matchDimension?: boolean | undefined
  remeasureHint?: number | undefined
  offset?: number | undefined
  style?: StylesCrossPlatform | undefined
  containerStyle?: StylesCrossPlatform | undefined
  visible?: boolean | undefined
  hideKeyboard?: boolean | undefined

  // Mobile only: BottomSheet snap points (only used when no attachTo)
  snapPoints?: Array<string | number> | undefined
}

declare const Popup: (p: PopupProps) => React.ReactNode
export default Popup
