import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import {EscapeHandler} from '@/common-adapters/key-event-handler.desktop'
import {ModalHeader, ModalFooter} from '@/common-adapters/modal2'
import type {GetOptions, GetOptionsParams, GetOptionsRet} from '@/constants/types/router'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

const mouseResetValue = -9999
const mouseDistanceThreshold = 5

const useMouseClick = (navigation: NativeStackNavigationProp<KBRootParamList>, noClose?: boolean) => {
  const backgroundRef = React.useRef<HTMLDivElement>(null)
  // we keep track of mouse down/up to determine if we should call it a 'click'. We don't want dragging the
  // window around to count
  const [mouseDownX, setMouseDownX] = React.useState(mouseResetValue)
  const [mouseDownY, setMouseDownY] = React.useState(mouseResetValue)
  const onMouseDown = (e: React.MouseEvent) => {
    const {screenX, screenY, target} = e.nativeEvent
    if (target !== backgroundRef.current) {
      return
    }
    setMouseDownX(screenX)
    setMouseDownY(screenY)
  }
  const onMouseUp = (e: React.MouseEvent) => {
    const {screenX, screenY, target} = e.nativeEvent
    if (target !== backgroundRef.current) {
      return
    }
    const xDist = Math.abs(screenX - mouseDownX)
    const yDist = Math.abs(screenY - mouseDownY)
    if (xDist < mouseDistanceThreshold && yDist < mouseDistanceThreshold) {
      if (!noClose) {
        navigation.pop()
      }
    }
    setMouseDownX(mouseResetValue)
    setMouseDownY(mouseResetValue)
  }
  return [backgroundRef, onMouseUp, onMouseDown] as const
}

type ModalWrapperProps = {
  children: React.ReactNode
  navigationOptions?: GetOptionsRet
  navigation: NativeStackNavigationProp<KBRootParamList>
}

const ModalWrapper = (p: ModalWrapperProps) => {
  const {navigationOptions, navigation, children} = p
  const {modal2Style, modal2AvoidTabs, modal2 = true, modal2ClearCover, modal2NoClose, modal2Header, modal2Footer} =
    navigationOptions ?? {}

  const [backgroundRef, onMouseUp, onMouseDown] = useMouseClick(navigation, modal2NoClose)

  const [topMostModal, setTopMostModal] = React.useState(true)

  C.Router2.useSafeFocusEffect(() => {
    setTopMostModal(true)
    return () => {
      setTopMostModal(false)
    }
  })

  if (modal2) {
    return (
      <EscapeHandler onESC={topMostModal ? () => navigation.pop() : undefined}>
        <Kb.Box2
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
            <Kb.Box2 direction="vertical" style={styles.modalMode}>
              {modal2Header ? <ModalHeader {...modal2Header} /> : null}
              {children}
              {modal2Footer ? <ModalFooter {...modal2Footer} wide={false} fullscreen={false} /> : null}
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
        </Kb.Box2>
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

const wrapInStrict = (_route: string) => {
  const wrap = true
  // TODO use this to disable strict if something is broken
  return wrap
}

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

export const makeLayout = (isModal: boolean, _isLoggedOut: boolean, getOptions?: GetOptions) => {
  return ({children, route, navigation}: LayoutProps) => {
    const navigationOptions = typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions
    const suspenseContent = <React.Suspense>{children}</React.Suspense>

    let body = suspenseContent

    if (isModal) {
      body = (
        <ModalWrapper navigation={navigation} navigationOptions={navigationOptions}>
          {body}
        </ModalWrapper>
      )
    }

    if (wrapInStrict(route.name)) {
      body = <React.StrictMode>{body}</React.StrictMode>
    }

    return body
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
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
  modalMode: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      maxHeight: '90vh',
      minHeight: 400,
      minWidth: 400,
      pointerEvents: 'auto',
      position: 'relative',
    },
  }),
}))
