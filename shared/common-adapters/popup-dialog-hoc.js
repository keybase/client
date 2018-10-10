// @flow
import * as React from 'react'
import PopupDialog from './popup-dialog'

export default function PopupDialogHoc<P>(
  ChildComponent: React.ComponentType<P>
): React.ComponentType<P & {onClosePopup: () => void}> {
  return ({onClosePopup, ...restProps}: P & {onClosePopup: () => void}) => (
    <PopupDialog onClose={onClosePopup} styleClose={{display: 'none'}}>
      <ChildComponent {...restProps} />
    </PopupDialog>
  )
}
