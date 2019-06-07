import * as React from 'react'
import PopupDialog from './popup-dialog'

export type HocExtractProps = {
  onClosePopup: () => void
}

export type WithoutPopupProps<P> = P extends HocExtractProps ? Omit<P, keyof HocExtractProps> : P

function popupDialogHoc<P extends {}>(
  Component: React.ComponentType<Omit<P, keyof HocExtractProps>>
): React.ComponentType<P & HocExtractProps> {
  return function WrappedPopupDialog(props: P & HocExtractProps) {
    const {onClosePopup, ...rest} = props
    return (
      <PopupDialog onClose={onClosePopup}>
        <Component {...rest} />
      </PopupDialog>
    )
  }
}

export default popupDialogHoc
