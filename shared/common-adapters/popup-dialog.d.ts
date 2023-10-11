import type * as React from 'react'

export type Props = {
  onClose?: () => void
  onMouseUp?: (e: React.MouseEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  allowClipBubbling?: boolean
  fill?: boolean
  children?: React.ReactNode
  immuneToEscape?: boolean
  styleCover?: any
  styleContainer?: any
  styleClose?: any
  styleClipContainer?: any
}

declare const PopupDialog: (p: Props) => React.ReactNode
export default PopupDialog
