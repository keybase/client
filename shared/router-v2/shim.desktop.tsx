import * as React from 'react'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {EscapeHandler} from '../util/key-event-handler.desktop'
import {useFocusEffect} from '@react-navigation/native'

export const getOptions = Shared.getOptions
export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

const mouseResetValue = -9999
const mouseDistanceThreshold = 5

const useMouseClick = (navigation, noClose) => {
  const backgroundRef = React.useRef(null)

  // we keep track of mouse down/up to determine if we should call it a 'click'. We don't want dragging the
  // window around to count
  const [mouseDownX, setMouseDownX] = React.useState(mouseResetValue)
  const [mouseDownY, setMouseDownY] = React.useState(mouseResetValue)
  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      const {screenX, screenY, target} = e.nativeEvent
      if (target !== backgroundRef.current) {
        return
      }
      setMouseDownX(screenX)
      setMouseDownY(screenY)
    },
    [setMouseDownX, setMouseDownY]
  )
  const onMouseUp = React.useCallback(
    (e: React.MouseEvent) => {
      const {screenX, screenY, target} = e.nativeEvent
      if (target !== backgroundRef.current) {
        return
      }
      const delta = Math.abs(screenX - mouseDownX) + Math.abs(screenY - mouseDownY)
      const dismiss = delta < mouseDistanceThreshold
      setMouseDownX(mouseResetValue)
      setMouseDownY(mouseResetValue)
      if (dismiss && !noClose) {
        navigation.pop()
      }
    },
    [setMouseDownX, setMouseDownY, mouseDownX, mouseDownY, noClose, navigation]
  )

  return [backgroundRef, onMouseUp, onMouseDown] as const
}
type ModalType = 'Default' | 'DefaultFullHeight' | 'DefaultFullWidth' | 'Wide' | 'SuperWide'
const ModalWrapper = ({navigationOptions, navigation, children}) => {
  const {modal2Style, modal2AvoidTabs, modal2, modal2ClearCover, modal2NoClose, modal2Type} =
    navigationOptions ?? {}

  const [backgroundRef, onMouseUp, onMouseDown] = useMouseClick(navigation, modal2NoClose)

  const modalModeToStyle = new Map<ModalType, Styles.StylesCrossPlatform>([
    ['Default', styles.modalModeDefault],
    ['DefaultFullHeight', styles.modalModeDefaultFullHeight],
    ['DefaultFullWidth', styles.modalModeDefaultFullWidth],
    ['Wide', styles.modalModeWide],
    ['SuperWide', styles.modalModeSuperWide],
  ] as const)

  const [topMostModal, setTopMostModal] = React.useState(true)

  useFocusEffect(
    React.useCallback(() => {
      setTopMostModal(true)
      return () => {
        setTopMostModal(false)
      }
    }, [])
  )

  if (modal2) {
    return (
      <EscapeHandler onESC={topMostModal ? navigation.pop : undefined}>
        <Kb.Box2
          key="background"
          direction="horizontal"
          ref={backgroundRef}
          style={Styles.collapseStyles([
            styles.modal2Container,
            modal2ClearCover && styles.modal2ClearCover,
            !topMostModal && styles.hidden,
          ])}
          onMouseDown={onMouseDown as any}
          onMouseUp={onMouseUp as any}
        >
          {modal2AvoidTabs && (
            <Kb.Box2 direction="vertical" className="tab-container" style={styles.modal2AvoidTabs} />
          )}
          <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.modal2Style, modal2Style])}>
            <Kb.Box2 direction="vertical" style={modalModeToStyle.get(modal2Type ?? 'Default')}>
              {children}
              {!modal2ClearCover && !modal2NoClose && (
                <Kb.Icon
                  type="iconfont-close"
                  onClick={() => navigation.pop()}
                  color={Styles.globalColors.whiteOrWhite_75}
                  hoverColor={Styles.globalColors.white_40OrWhite_40}
                  style={styles.modal2CloseIcon}
                />
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </EscapeHandler>
    )
  } else {
    return (
      <Kb.Box2
        key="background"
        direction="vertical"
        style={Styles.collapseStyles([styles.modalContainer, !topMostModal && styles.hidden])}
      >
        {children}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(() => {
  const modalModeCommon = Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      pointerEvents: 'auto',
      position: 'relative',
    },
  })
  return {
    contentArea: {
      flexGrow: 1,
      position: 'relative',
    },
    contentAreaLogin: Styles.platformStyles({
      isElectron: {
        flexGrow: 1,
        position: 'relative',
      },
      isMobile: {
        flexGrow: 1,
        position: 'relative',
      },
    }),
    hidden: {
      display: 'none',
    },
    modal2AvoidTabs: Styles.platformStyles({
      isElectron: {
        backgroundColor: undefined,
        height: 0,
        pointerEvents: 'none',
      },
    }),
    modal2ClearCover: {backgroundColor: undefined},
    modal2CloseIcon: Styles.platformStyles({
      isElectron: {
        cursor: 'pointer',
        padding: Styles.globalMargins.tiny,
        position: 'absolute',
        right: Styles.globalMargins.tiny * -4,
        top: 0,
      },
    }),
    modal2Container: {
      ...Styles.globalStyles.fillAbsolute,
      backgroundColor: Styles.globalColors.black_50OrBlack_60,
    },
    modal2Style: Styles.platformStyles({
      isElectron: {flexGrow: 1, pointerEvents: 'none'},
    }),
    modalContainer: {
      ...Styles.globalStyles.fillAbsolute,
    },
    modalModeDefault: Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        maxHeight: 560,
        width: 400,
      },
    }),
    modalModeDefaultFullHeight: Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 560,
        width: 400,
      },
    }),
    modalModeDefaultFullWidth: Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 560,
        width: '100%',
      },
    }),
    modalModeSuperWide: Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: Math.floor(document.body.scrollHeight * 0.8), // super hacky, want to minimally change how this thing works
        width: '80%',
      },
    }),
    modalModeWide: Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 400,
        width: 560,
      },
    }),
    sceneContainer: {flexDirection: 'column'},
    transparentSceneUnderHeader: {...Styles.globalStyles.fillAbsolute},
  } as const
})

const shimNewRoute = (Original: any, isModal: boolean, _isLoggedOut: boolean, getOptions: any) => {
  const ShimmedNew = React.memo(function ShimmedNew(props: any) {
    const navigationOptions =
      typeof getOptions === 'function'
        ? getOptions({navigation: props.navigation, route: props.route})
        : getOptions
    const original = <Original {...props} />
    let body = original

    if (isModal) {
      body = (
        <ModalWrapper navigation={props.navigation} navigationOptions={navigationOptions}>
          {body}
        </ModalWrapper>
      )
    }

    return body
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}
