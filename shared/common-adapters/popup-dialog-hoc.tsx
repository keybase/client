import * as React from 'react'
import PopupDialog from './popup-dialog'

type HocExtractProps = {
  onClosePopup: () => void
};

function popupDialogHoc<Config extends {} & HocExtractProps>(Component: React.AbstractComponent<Exclude<Config, HocExtractProps>>): React.AbstractComponent<Config & HocExtractProps> {
  return function WrappedPopupDialog(props: Config) {
    const {onClosePopup, ...rest} = props
    return (
      <PopupDialog onClose={onClosePopup} styleClose={{display: 'none'}}>
        <Component {...rest} />
      </PopupDialog>
    )
  };
}

export default popupDialogHoc
