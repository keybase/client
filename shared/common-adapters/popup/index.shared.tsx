import type {MeasureRef} from '@/common-adapters/measure-ref'
import type * as React from 'react'
import type * as Styles from '@/styles'

export type PopupProps = {
  children: React.ReactNode
  onHidden?: () => void
  attachTo?: React.RefObject<MeasureRef | null>
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  propagateOutsideClicks?: boolean
  matchDimension?: boolean
  remeasureHint?: number
  offset?: number
  style?: Styles.StylesCrossPlatform
  containerStyle?: Styles.StylesCrossPlatform
  visible?: boolean
  hideKeyboard?: boolean
  snapPoints?: Array<string | number>
}
