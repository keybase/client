import type {MeasureRef} from '@/common-adapters/measure-ref'
import type * as React from 'react'
import type * as Styles from '@/styles'

export type PopupProps = {
  children: React.ReactNode
  onHidden?: () => void
  attachTo?: React.RefObject<MeasureRef | null>
  // mobile ignores attachTo and presents a bottom sheet by default; set this
  // to keep the raw anchored portal on mobile (e.g. positioned over an input)
  mobileAnchored?: boolean
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
  // mobile sheet only: pinned below the scrolling content, always visible
  footer?: React.ReactNode
}
