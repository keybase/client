import type {MeasureRef} from '@/common-adapters/measure-ref'
import type * as React from 'react'
import type * as Styles from '@/styles'

// Anchored to an on-screen element. Desktop measures the anchor and positions
// against it; mobile has no positioner and only covers the screen, so it reads
// none of the placement props.
export type AnchoredPopupProps = {
  children: React.ReactNode
  onHidden?: () => void
  attachTo?: React.RefObject<MeasureRef | null>
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  propagateOutsideClicks?: boolean
  matchDimension?: boolean
  remeasureHint?: number
  offset?: number
  containerStyle?: Styles.StylesCrossPlatform
  // desktop only: styles the shadowed box drawn around the content, which only
  // exists when onHidden is set. mobile has no such box - use containerStyle.
  style?: Styles.StylesCrossPlatform
  // mobile only
  hideKeyboard?: boolean
}

// Mobile bottom sheet. Presents on mount, so callers mount it only while shown.
export type SheetProps = {
  children: React.ReactNode
  onHidden: () => void
  snapPoints?: Array<string | number>
  // pinned below the scrolling content, always visible
  footer?: React.ReactNode
  style?: Styles.StylesCrossPlatform
}

// Desktop full-window cover with the content centered on it.
export type ModalCoverProps = {
  children: React.ReactNode
  onHidden?: () => void
  style?: Styles.StylesCrossPlatform
}

type SharedPopupProps = {
  children: React.ReactNode
  onHidden: () => void
  style?: Styles.StylesCrossPlatform
  // mobile sheet only
  snapPoints?: Array<string | number>
  footer?: React.ReactNode
}

export type PopupProps = SharedPopupProps &
  (
    | ({intent: 'menu'} & Pick<
        AnchoredPopupProps,
        | 'attachTo'
        | 'containerStyle'
        | 'matchDimension'
        | 'offset'
        | 'position'
        | 'positionFallbacks'
        | 'propagateOutsideClicks'
        | 'remeasureHint'
      >)
    | {intent: 'dialog'}
  )
