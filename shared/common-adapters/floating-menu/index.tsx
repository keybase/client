// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import {Box2} from '../box'
import type {MeasureRef} from '../measure-ref'
import MenuLayout, {type MenuItems as _MenuItems} from './menu-layout'
import * as Styles from '../../styles'
import {BottomSheetModal, BottomSheetBackdrop, type BottomSheetBackdropProps} from '../bottom-sheet'

const Kb = {
  Box2,
  Overlay,
}

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: React.RefObject<MeasureRef>
  backgroundColor?: Styles.Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform
  header?: React.ReactNode
  items: ReadonlyArray<_MenuItems[0]>
  listStyle?: Object
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

const defSnapPoints = ['50%', '95%']

const Backdrop = React.memo(function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
})

const FloatingMenu = (props: Props) => {
  const {snapPoints = defSnapPoints} = props
  const isModal = React.useContext(FloatingModalContext)
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null)
  React.useEffect(() => {
    bottomSheetModalRef.current?.present()
  }, [])

  if (!props.visible && isModal === false) {
    return null
  }

  const contents = (
    <MenuLayout
      isModal={isModal}
      header={props.header}
      onHidden={props.onHidden}
      items={props.items}
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

  if (isModal === 'bottomsheet') {
    return (
      <BottomSheetModal
        snapPoints={snapPoints}
        ref={bottomSheetModalRef}
        handleStyle={styles.handleStyle}
        handleIndicatorStyle={styles.handleIndicatorStyle}
        style={styles.modalStyle}
        backdropComponent={Backdrop}
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
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      handleIndicatorStyle: {backgroundColor: Styles.globalColors.black_40},
      handleStyle: {backgroundColor: Styles.globalColors.white},
      modalStyle: {
        backgroundColor: Styles.globalColors.white,
        elevation: 17,
        shadowColor: Styles.globalColors.black_50OrBlack_40,
        shadowOffset: {height: 5, width: 0},
        shadowOpacity: 1,
        shadowRadius: 10,
      },
    }) as const
)

export default FloatingMenu

// escape hatch to make a floating to a modal
export type FloatingModalType = boolean | 'bottomsheet'
export const FloatingModalContext = React.createContext<FloatingModalType>(false)
