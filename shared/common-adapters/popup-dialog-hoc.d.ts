import * as React from 'react'
declare type HocExtractProps = {
  onClosePopup: () => void
}
export declare type WithoutPopupProps<P> = P extends HocExtractProps ? Omit<P, keyof HocExtractProps> : P
declare function popupDialogHoc<P extends {}>(
  Component: React.ComponentType<P>
): React.ComponentType<P & HocExtractProps>
export default popupDialogHoc
