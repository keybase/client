import * as React from 'react'
import * as Styles from '@/styles'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet'
import {useSafeAreaInsets} from '../safe-area-view'
import {initialWindowMetrics} from 'react-native-safe-area-context'
import {FullWindowOverlay} from 'react-native-screens'
import {Keyboard, useWindowDimensions} from 'react-native'
import {isTablet} from '@/constants/platform'
import type {SheetProps} from './index.shared'
export type {SheetProps} from './index.shared'

// The sheet lives in a FullWindowOverlay, so it needs the window's insets. The
// nearest SafeAreaProvider can't supply them: a provider nested inside a
// react-native-screens scene (every modal route) re-measures to ~0.
const useWindowInsets = () => {
  const local = useSafeAreaInsets()
  const window = initialWindowMetrics?.insets
  return {
    bottom: Math.max(window?.bottom ?? 0, local.bottom),
    left: Math.max(window?.left ?? 0, local.left),
    right: Math.max(window?.right ?? 0, local.right),
    top: Math.max(window?.top ?? 0, local.top),
  }
}

// Phone sheets span the window, which reads badly on a wide phone window (iPhone Duo unfolded,
// landscape), so past this width the sheet is centered. Every iPhone in portrait is narrower.
// iPad keeps full-width sheets.
const maxPhoneSheetWidth = 500

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
}

const FullWindow = ({children}: {children?: React.ReactNode}): React.ReactNode => {
  return isIOS ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

export function Sheet(props: SheetProps) {
  const styles = useStyles()
  const {children, footer, onHidden, snapPoints, style} = props
  const {bottom: safeBottom, left: safeLeft, right: safeRight, top: safeTop} = useWindowInsets()
  const {width: windowWidth} = useWindowDimensions()
  // the library pins the sheet to both window edges (left/right 0), so margins place it
  const sideMargin = isTablet ? 0 : Math.max(0, (windowWidth - safeLeft - safeRight - maxPhoneSheetWidth) / 2)
  const sheetStyle = Styles.collapseStyles([
    styles.modalStyle,
    {marginLeft: safeLeft + sideMargin, marginRight: safeRight + sideMargin},
  ])
  const bottomRef = React.useRef<React.ComponentRef<typeof BottomSheetModal> | null>(null)
  // the sheet's content clears the home indicator plus a margin, so the last row
  // never sits flush with the screen edge
  const contentBottom = safeBottom + Styles.globalMargins.medium
  const indicatorInsets = React.useMemo(() => ({bottom: contentBottom}), [contentBottom])

  // the footer floats over the scrolled content down to the screen edge, so the
  // caller's node must bring its own background and bottom safe-area padding
  const renderFooter = React.useCallback(
    (fp: BottomSheetFooterProps) => <BottomSheetFooter {...fp}>{footer}</BottomSheetFooter>,
    [footer]
  )

  React.useEffect(() => {
    // the sheet covers the bottom of the screen, so a raised keyboard would hide it
    Keyboard.dismiss()
    bottomRef.current?.present()
    return () => {
      bottomRef.current?.forceClose()
      bottomRef.current = null
    }
  }, [])

  const setBottomSheetRef = (sheet: React.ComponentRef<typeof BottomSheetModal> | null) => {
    bottomRef.current = sheet
  }

  return (
    <BottomSheetModal
      ref={setBottomSheetRef}
      // the library makes the sheet one accessibility element, which hides every row in it from
      // VoiceOver and UI automation
      accessible={false}
      enableDynamicSizing={true}
      // no snapPoints -> dynamic sizing only: sheet hugs content and can't be dragged taller
      snapPoints={snapPoints}
      backgroundStyle={styles.modalBackground}
      containerComponent={FullWindow}
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      style={sheetStyle}
      backdropComponent={Backdrop}
      onDismiss={onHidden}
      // dynamic sizing clamps to the container (full window via FullWindowOverlay),
      // so without this tall sheets cover the status bar
      topInset={safeTop}
      footerComponent={footer ? renderFooter : undefined}
    >
      {/* a scrollable must be the sheet's direct child: nesting one inside
          BottomSheetView measures unbounded, so tall content clips instead of scrolling */}
      <BottomSheetScrollView
        alwaysBounceVertical={false}
        overScrollMode="never"
        enableFooterMarginAdjustment={!!footer}
        style={style}
        // a footer brings its own bottom inset
        contentContainerStyle={footer ? undefined : {paddingBottom: contentBottom}}
        // iOS otherwise insets the content by the safe area on its own, on top of
        // the padding above. The indicator still has to clear that padding, so it
        // gets the inset explicitly rather than from the automatic adjustment.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={footer ? undefined : indicatorInsets}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const useStyles = Styles.createStyleHook(
  theme =>
    ({
      handleIndicatorStyle: {backgroundColor: theme.black_40},
      handleStyle: {backgroundColor: theme.black_05_on_white},
      modalBackground: {backgroundColor: theme.black_05_on_white},
      modalStyle: Styles.platformStyles({
        isAndroid: {
          elevation: 17,
          shadowColor: theme.black_50OrBlack_40,
          shadowOffset: {height: 5, width: 0},
          shadowOpacity: 1,
          shadowRadius: 10,
        },
      }),
    }) as const
)
