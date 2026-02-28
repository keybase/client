import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  onClose?: () => void
  onMouseUp?: (e: React.MouseEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  allowClipBubbling?: boolean
  fill?: boolean
  children?: React.ReactNode
  immuneToEscape?: boolean
  styleCover?: Styles.StylesCrossPlatform
  styleClipContainer?: Styles.StylesCrossPlatform
  styleClose?: Styles.StylesCrossPlatform
  styleContainer?: Styles.StylesCrossPlatform
}

declare const PopupDialog: (p: Props) => React.ReactNode
export default PopupDialog
