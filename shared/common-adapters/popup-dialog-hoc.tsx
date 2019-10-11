import * as React from 'react'
import PopupDialog from './popup-dialog'
import * as Styles from '../styles'

export type HocExtractProps = {
  onClosePopup: () => void
  tabBarShim?: boolean
  closeStyleOverrides?: Styles.StylesCrossPlatform
  containerStyleOverrides?: Styles.StylesCrossPlatform
  coverStyleOverrides?: Styles.StylesCrossPlatform
}

export type WithoutPopupProps<P> = P extends HocExtractProps ? Omit<P, keyof HocExtractProps> : P

function popupDialogHoc<P extends {}>(
  Component: React.ComponentType<Omit<P, keyof HocExtractProps>>
): React.ComponentType<P & HocExtractProps> {
  return function WrappedPopupDialog(props: P & HocExtractProps) {
    const {
      onClosePopup,
      tabBarShim,
      containerStyleOverrides,
      coverStyleOverrides,
      closeStyleOverrides,
      ...rest
    } = props
    return (
      <PopupDialog
        onClose={onClosePopup}
        styleCover={coverStyleOverrides}
        styleClose={closeStyleOverrides}
        styleContainer={containerStyleOverrides}
        tabBarShim={tabBarShim}
      >
        <Component {...rest} />
      </PopupDialog>
    )
  }
}

export default popupDialogHoc
