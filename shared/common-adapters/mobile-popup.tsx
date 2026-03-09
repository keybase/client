import * as React from 'react'
import * as Styles from '@/styles'
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from './bottom-sheet'
import {FullWindowOverlay} from 'react-native-screens'

type Props = {
  children: React.ReactNode
  onDismiss?: () => void
  snapPoints?: Array<string | number>
}

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
}

const FullWindow = ({children}: {children?: React.ReactNode}): React.ReactNode => {
  return Styles.isIOS ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

const MobilePopup = (props: Props) => {
  const {children, onDismiss, snapPoints} = props
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
      enableDynamicSizing={!snapPoints}
      snapPoints={snapPoints}
      backgroundStyle={styles.modalBackground}
      containerComponent={FullWindow}
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      style={styles.modalStyle}
      backdropComponent={Backdrop}
      onDismiss={onDismiss}
    >
      <BottomSheetView>{children}</BottomSheetView>
    </BottomSheetModal>
  )
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

export default MobilePopup
