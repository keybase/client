import type {MeasureRef} from '@/common-adapters/measure-ref'
import type * as Styles from '@/styles'
import type * as React from 'react'

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
