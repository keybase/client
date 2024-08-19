// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import {Box2} from '@/common-adapters/box'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import MenuLayout, {type MenuItems as _MenuItems} from './menu-layout'
import * as Styles from '@/styles'
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@/common-adapters/bottom-sheet'
import {useSafeAreaInsets} from '@/common-adapters/safe-area-view'
import {FloatingModalContext} from './context'
import {FullWindowOverlay} from 'react-native-screens'

const Kb = {
  Box2,
  Overlay,
  useSafeAreaInsets,
}

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: React.RefObject<MeasureRef>
  backgroundColor?: Styles.Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform
  header?: React.ReactNode
  items: ReadonlyArray<_MenuItems[number]>
  listStyle?: object
  onHidden: () => void
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  textColor?: Styles.Color
  visible: boolean
  // mobile only
  safeProviderStyle?: Styles.StylesCrossPlatform
  snapPoints?: Array<string | number>
}

const Backdrop = React.memo(function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
})

const FullWindow = ({children}: {children?: React.ReactNode}) => {
  return Styles.isIOS ? <FullWindowOverlay>{children}</FullWindowOverlay> : children
}

const FloatingMenu = React.memo(function FloatingMenu(props: Props) {
  const {snapPoints, items, visible} = props
  const isModal = React.useContext(FloatingModalContext)
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null)
  React.useEffect(() => {
    bottomSheetModalRef.current?.present()
  }, [])

  if (!visible && isModal === false) {
    return null
  }

  const contents = (
    <MenuLayout
      isModal={isModal}
      header={props.header}
      onHidden={props.onHidden}
      items={items}
      closeOnClick={props.closeOnSelect}
      closeText={props.closeText}
      listStyle={props.listStyle}
      textColor={props.textColor}
      backgroundColor={props.backgroundColor}
      safeProviderStyle={props.safeProviderStyle}
    />
  )

  if (isModal === true) {
    return contents
  }

  if (Styles.isMobile && isModal === 'bottomsheet') {
    return (
      <BottomSheetModal
        containerComponent={FullWindow}
        snapPoints={snapPoints}
        enableDynamicSizing={true}
        ref={bottomSheetModalRef}
        handleStyle={styles.handleStyle}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        style={styles.modalStyle}
        backdropComponent={Backdrop}
        onDismiss={props.onHidden}
      >
        {contents}
      </BottomSheetModal>
    )
  }

  return (
    <Kb.Overlay
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      remeasureHint={props.remeasureHint}
      style={props.containerStyle}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      {contents}
    </Kb.Overlay>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      handleIndicatorStyle: {backgroundColor: Styles.globalColors.black_40},
      handleStyle: {backgroundColor: Styles.globalColors.black_05OrBlack},
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

export default FloatingMenu
