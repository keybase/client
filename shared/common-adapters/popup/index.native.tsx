import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '../box'
import {Keyboard} from 'react-native'
import {Portal} from '../portal.native'
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from './bottom-sheet'
import {FullWindowOverlay} from 'react-native-screens'
import type {PopupProps} from '.'

const defaultSnapPoints = ['75%']

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
}

const FullWindow = ({children}: {children?: React.ReactNode}): React.ReactNode => {
  return Styles.isIOS ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

function PopupPositioned(props: PopupProps) {
  const {hideKeyboard, children, containerStyle} = props
  const [lastHK, setLastHK] = React.useState(hideKeyboard)
  if (lastHK !== hideKeyboard) {
    setLastHK(hideKeyboard)
    if (hideKeyboard) {
      Keyboard.dismiss()
    }
  }
  return (
    <Portal hostName="popup-root">
      <Box2
        direction="vertical"
        pointerEvents="box-none"
        style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, containerStyle])}
      >
        {children}
      </Box2>
    </Portal>
  )
}

function PopupSheet(props: PopupProps) {
  const {children, onHidden, snapPoints} = props
  const bottomRef = React.useRef<BottomSheetModal | null>(null)
  const shownRef = React.useRef(false)

  React.useEffect(() => {
    return () => {
      bottomRef.current?.forceClose()
    }
  }, [])

  return (
    <BottomSheetModal
      ref={s => {
        if (bottomRef.current && bottomRef.current !== s) {
          bottomRef.current.forceClose()
        }
        bottomRef.current = s
        if (s && !shownRef.current) {
          shownRef.current = true
          setTimeout(() => {
            s.present()
          }, 100)
        }
      }}
      enableDynamicSizing={true}
      snapPoints={snapPoints ?? defaultSnapPoints}
      backgroundStyle={styles.modalBackground}
      containerComponent={FullWindow}
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      style={styles.modalStyle}
      backdropComponent={Backdrop}
      onDismiss={onHidden}
    >
      <BottomSheetView>{children}</BottomSheetView>
    </BottomSheetModal>
  )
}

function PopupPortal(props: PopupProps) {
  const {children} = props
  return (
    <Portal hostName="popup-root">
      {children}
    </Portal>
  )
}

function Popup(props: PopupProps) {
  if (props.attachTo) {
    return <PopupPositioned {...props} />
  }
  if (!props.onHidden) {
    return <PopupPortal {...props} />
  }
  return <PopupSheet {...props} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      handleIndicatorStyle: {backgroundColor: Styles.globalColors.black_40},
      handleStyle: {backgroundColor: Styles.globalColors.black_05_on_white},
      modalBackground: {backgroundColor: Styles.globalColors.black_05_on_white},
      modalStyle: Styles.platformStyles({
        isAndroid: {
          elevation: 17,
          shadowColor: Styles.globalColors.black_50OrBlack_40,
          shadowOffset: {height: 5, width: 0},
          shadowOpacity: 1,
          shadowRadius: 10,
        },
      }),
    }) as const
)

export default Popup
