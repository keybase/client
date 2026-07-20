import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '../box'
import FloatingBox from './floating-box'
import {EscapeHandler} from '../key-event-handler'
import {Portal} from '../portal'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from './bottom-sheet'
import {useSafeAreaInsets} from '../safe-area-view'
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

function PopupPositioned(props: PopupProps) {
  // on mobile FloatingBox is the same portal + keyboard-dismiss overlay this needs
  return isMobile ? <FloatingBox {...props} /> : <DesktopPopupPositioned {...props} />
}

function PopupCentered(props: PopupProps) {
  const [mouseDownOnCover, setMouseDownOnCover] = React.useState(false)
  return (
    <EscapeHandler onESC={props.onHidden ?? (() => {})}>
      <Box2
        direction="vertical"
        centerChildren={true}
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
          direction="horizontal"
          relative={true}
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
  const {children, footer, onHidden, snapPoints} = props
  const {top: safeTop} = useSafeAreaInsets()
  const bottomRef = React.useRef<BottomSheetModal | null>(null)

  // the footer floats over the scrolled content down to the screen edge, so the
  // caller's node must bring its own background and bottom safe-area padding
  const renderFooter = React.useCallback(
    (fp: BottomSheetFooterProps) => <BottomSheetFooter {...fp}>{footer}</BottomSheetFooter>,
    [footer]
  )

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
      // dynamic sizing clamps to the container (full window via FullWindowOverlay),
      // so without this tall sheets cover the status bar
      topInset={safeTop}
      footerComponent={footer ? renderFooter : undefined}
    >
      {/* a scrollable must be the sheet's direct child: nesting one inside
          BottomSheetView measures unbounded, so tall content clips instead of scrolling */}
      <BottomSheetScrollView enableFooterMarginAdjustment={!!footer}>{children}</BottomSheetScrollView>
    </BottomSheetModal>
  )
}

function Popup(props: PopupProps) {
  // sheets present on mount, so an explicitly hidden popup must not render
  if (Object.hasOwn(props, 'visible') && !props.visible) {
    return null
  }
  if (props.attachTo && (!isMobile || props.mobileAnchored)) {
    return <PopupPositioned {...props} />
  }
  if (isMobile) {
    if (!props.onHidden) {
      return <Portal hostName="popup-root">{props.children}</Portal>
    }
    return <PopupSheet {...props} />
  }
  return <PopupCentered {...props} />
}

const desktopStyles = Styles.styleSheetCreate(() => ({
  centeredContainer: {
    maxHeight: '100%',
    maxWidth: '100%',
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
    ...Styles.globalStyles.fillAbsolute,
    alignSelf: 'stretch',
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.large, Styles.globalMargins.small),
  },
  positioned: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.globalStyles.rounded,
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
