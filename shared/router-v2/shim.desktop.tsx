import * as React from 'react'
import * as C from '@/constants'
import * as Shared from './shim.shared'
import * as Kb from '@/common-adapters'
import {EscapeHandler} from '@/common-adapters/key-event-handler.desktop'
import type {
  RouteMap,
  GetOptions,
  GetOptionsParams,
  GetOptionsRet,
  ModalType,
} from '@/constants/types/router2'

export const getOptions = Shared._getOptions
export const shim = (routes: RouteMap, isModal: boolean, isLoggedOut: boolean) =>
  Shared._shim(routes, platformShim, isModal, isLoggedOut)

const mouseResetValue = -9999
const mouseDistanceThreshold = 5

const useMouseClick = (navigation: {pop: () => void}, noClose?: boolean) => {
  const backgroundRef = React.useRef<HTMLDivElement>(null)

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
type WrapProps = {
  navigationOptions?: GetOptionsRet
  navigation: {pop: () => void}
  children: React.ReactNode
}

const ModalWrapper = (p: WrapProps) => {
  const {navigationOptions, navigation, children} = p
  const {modal2Style, modal2AvoidTabs, modal2, modal2ClearCover, modal2NoClose, modal2Type} =
    navigationOptions ?? {}

  const [backgroundRef, onMouseUp, onMouseDown] = useMouseClick(navigation, modal2NoClose)

  const modalModeToStyle = new Map<ModalType, Kb.Styles.StylesCrossPlatform>([
    ['Default', styles.modalModeDefault],
    ['DefaultFullHeight', styles.modalModeDefaultFullHeight],
    ['DefaultFullWidth', styles.modalModeDefaultFullWidth],
    ['Wide', styles.modalModeWide],
    ['SuperWide', styles.modalModeSuperWide],
  ] as const)

  const [topMostModal, setTopMostModal] = React.useState(true)

  C.Router2.useSafeFocusEffect(
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
        <Kb.Box2Div
          key="background"
          direction="horizontal"
          ref={backgroundRef}
          style={Kb.Styles.collapseStyles([
            styles.modal2Container,
            modal2ClearCover && styles.modal2ClearCover,
            !topMostModal && styles.hidden,
          ])}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
        >
          {modal2AvoidTabs && (
            <Kb.Box2 direction="vertical" className="tab-container" style={styles.modal2AvoidTabs} />
          )}
          <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.modal2Style, modal2Style])}>
            <Kb.Box2 direction="vertical" style={modalModeToStyle.get(modal2Type ?? 'Default')}>
              {children}
              {!modal2ClearCover && !modal2NoClose && (
                <Kb.Icon
                  type="iconfont-close"
                  onClick={() => navigation.pop()}
                  color={Kb.Styles.globalColors.whiteOrWhite_75}
                  hoverColor={Kb.Styles.globalColors.white_40OrWhite_40}
                  style={styles.modal2CloseIcon}
                />
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2Div>
      </EscapeHandler>
    )
  } else {
    return (
      <Kb.Box2
        key="background"
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.modalContainer, !topMostModal && styles.hidden])}
      >
        {children}
      </Kb.Box2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => {
  const modalModeCommon = Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      pointerEvents: 'auto',
      position: 'relative',
    },
  })
  return {
    contentArea: {
      flexGrow: 1,
      position: 'relative',
    },
    contentAreaLogin: Kb.Styles.platformStyles({
      isElectron: {
        flexGrow: 1,
        position: 'relative',
      },
      isMobile: {
        flexGrow: 1,
        position: 'relative',
      },
    }),
    hidden: {display: 'none'},
    modal2AvoidTabs: Kb.Styles.platformStyles({
      isElectron: {
        backgroundColor: undefined,
        height: 0,
        pointerEvents: 'none',
      },
    }),
    modal2ClearCover: {backgroundColor: undefined},
    modal2CloseIcon: Kb.Styles.platformStyles({
      isElectron: {
        cursor: 'pointer',
        padding: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny * -4,
        top: 0,
      },
    }),
    modal2Container: {
      ...Kb.Styles.globalStyles.fillAbsolute,
      // bg handled up a level w css
      // backgroundColor: Kb.Styles.globalColors.black_50OrBlack_60,
    },
    modal2Style: Kb.Styles.platformStyles({
      isElectron: {flexGrow: 1, pointerEvents: 'none'},
    }),
    modalContainer: Kb.Styles.platformStyles({
      isElectron: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        alignSelf: 'normal',
      },
    }),
    modalModeDefault: Kb.Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        maxHeight: 560,
        width: 400,
      },
    }),
    modalModeDefaultFullHeight: Kb.Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 560,
        width: 400,
      },
    }),
    modalModeDefaultFullWidth: Kb.Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 560,
        width: '100%',
      },
    }),
    modalModeSuperWide: Kb.Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: Math.floor(document.body.scrollHeight * 0.8), // super hacky, want to minimally change how this thing works
        width: '80%',
      },
    }),
    modalModeWide: Kb.Styles.platformStyles({
      common: {...modalModeCommon},
      isElectron: {
        height: 400,
        width: 560,
      },
    }),
    sceneContainer: {flexDirection: 'column'},
    transparentSceneUnderHeader: {...Kb.Styles.globalStyles.fillAbsolute},
  } as const
})

const platformShim = (
  Original: React.JSXElementConstructor<GetOptionsParams>,
  isModal: boolean,
  _isLoggedOut: boolean,
  getOptions?: GetOptions
) => {
  return React.memo(function ShimmedNew(props: GetOptionsParams) {
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
}
