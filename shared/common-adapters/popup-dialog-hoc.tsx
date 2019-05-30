import * as React from 'react'
import PopupDialog from './popup-dialog'

type HocExtractProps = {
  onClosePopup: () => void
}

function popupDialogHoc<Config extends HocExtractProps>(
  Component: React.ComponentType<Pick<Config, Exclude<keyof Config, keyof HocExtractProps>>>
): React.FunctionComponent<Config & HocExtractProps> {
  return function WrappedPopupDialog(props: Config) {
    const {onClosePopup, ...rest} = props
    return (
      <PopupDialog onClose={onClosePopup}>
        <Component {...rest} />
      </PopupDialog>
    )
  }
}

export default popupDialogHoc
