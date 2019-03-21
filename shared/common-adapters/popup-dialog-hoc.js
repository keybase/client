// @flow
import * as React from 'react'
import PopupDialog from './popup-dialog'

type HocExtractProps = {
  onClosePopup: () => void,
  showCloseButtonPopup?: boolean,
}

function popupDialogHoc<Config: {} & HocExtractProps>(
  Component: React.AbstractComponent<$Diff<Config, HocExtractProps>>
): React.AbstractComponent<Config & HocExtractProps> {
  return function WrappedPopupDialog(props: Config) {
    const {onClosePopup, showCloseButtonPopup, ...rest} = props
    return (
      <PopupDialog onClose={onClosePopup} styleClose={showCloseButtonPopup ? undefined : {display: 'none'}}>
        <Component {...rest} />
      </PopupDialog>
    )
  }
}

export default popupDialogHoc
