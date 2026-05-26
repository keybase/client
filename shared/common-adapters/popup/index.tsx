import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '../box'
import FloatingBox from './floating-box'
import {EscapeHandler} from '../key-event-handler'
import {Keyboard} from 'react-native'
import {Portal} from '../portal'
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from './bottom-sheet'
import {FullWindowOverlay} from 'react-native-screens'
import type {PopupProps} from './index.shared'
export type {PopupProps} from './index.shared'

const defaultSnapPoints = ['75%']

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
}

const FullWindow = ({children}: {children?: React.ReactNode}): React.ReactNode => {
  return isIOS ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

function DesktopPopupPositioned(props: PopupProps) {
  if (Object.hasOwn(props, 'visible') && !props.visible) {
    return null
  }
  return (
    <FloatingBox
      attachTo={props.attachTo}
      containerStyle={props.containerStyle}
      matchDimension={!!props.matchDimension}
      onHidden={props.onHidden}
      remeasureHint={props.remeasureHint}
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      propagateOutsideClicks={props.propagateOutsideClicks}
      offset={props.offset}
    >
      {props.onHidden ? (
        <Box2 direction="vertical" style={Styles.collapseStyles([desktopStyles.positioned, props.style])}>
          {props.children}
        </Box2>
      ) : (
        props.children
      )}
    </FloatingBox>
  )
}

function NativePopupPositioned(props: PopupProps) {
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

function PopupPositioned(props: PopupProps) {
  return isMobile ? <NativePopupPositioned {...props} /> : <DesktopPopupPositioned {...props} />
}

function PopupCentered(props: PopupProps) {
  const [mouseDownOnCover, setMouseDownOnCover] = React.useState(false)
  return (
    <EscapeHandler onESC={props.onHidden ?? (() => {})}>
      <Box2
        direction="vertical"
        style={Styles.collapseStyles([desktopStyles.cover, props.style])}
        onMouseUp={() => {
          if (mouseDownOnCover) {
            props.onHidden?.()
          }
        }}
        onMouseDown={() => {
          setMouseDownOnCover(true)
        }}
      >
        <Box2
          direction="vertical"
          style={desktopStyles.centeredContainer}
          onMouseDown={(e: React.BaseSyntheticEvent) => {
            setMouseDownOnCover(false)
            e.stopPropagation()
          }}
          onMouseUp={(e: React.BaseSyntheticEvent) => e.stopPropagation()}
        >
          <div
            style={desktopStyles.clipContainer as React.CSSProperties}
            onClick={stopBubbling}
          >
            {props.children}
          </div>
        </Box2>
      </Box2>
    </EscapeHandler>
  )
}

function stopBubbling(ev: React.MouseEvent<HTMLDivElement>) {
  ev.stopPropagation()
}

function PopupSheet(props: PopupProps) {
  const {children, onHidden, snapPoints} = props
  const bottomRef = React.useRef<BottomSheetModal | null>(null)

  React.useEffect(() => {
    bottomRef.current?.present()
    return () => {
      bottomRef.current?.forceClose()
      bottomRef.current = null
    }
  }, [])

  const setBottomSheetRef = (sheet: BottomSheetModal | null) => {
    bottomRef.current = sheet
  }

  return (
    <BottomSheetModal
      ref={setBottomSheetRef}
      enableDynamicSizing={true}
      snapPoints={snapPoints ?? defaultSnapPoints}
      backgroundStyle={nativeStyles.modalBackground}
      containerComponent={FullWindow}
      handleStyle={nativeStyles.handleStyle}
      handleIndicatorStyle={nativeStyles.handleIndicatorStyle}
      style={nativeStyles.modalStyle}
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
  if (isMobile) {
    if (!props.onHidden) {
      return <PopupPortal {...props} />
    }
    return <PopupSheet {...props} />
  }
  return <PopupCentered {...props} />
}

const desktopStyles = Styles.styleSheetCreate(() => ({
  centeredContainer: {
    ...Styles.globalStyles.flexBoxRow,
    maxHeight: '100%',
    maxWidth: '100%',
    position: 'relative' as const,
  },
  clipContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      flex: 1,
      maxWidth: '100%',
      position: 'relative',
    },
  }),
  cover: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.fillAbsolute,
    ...Styles.centered(),
    alignSelf: 'stretch',
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.large, Styles.globalMargins.small),
  },
  positioned: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: 3,
      overflowX: 'hidden',
      overflowY: 'auto',
    },
  }),
}))

const nativeStyles = Styles.styleSheetCreate(
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
