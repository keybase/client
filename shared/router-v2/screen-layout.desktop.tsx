import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
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
  const {overlayStyle, overlayAvoidTabs, overlayTransparent, overlayNoClose, modalFooter, modalStyle} =
    navigationOptions ?? {}

  // Build header from standard React Navigation options
  const headerTitle = navigationOptions?.['headerTitle'] ?? navigationOptions?.['title']
  const headerLeft = navigationOptions?.['headerLeft']
  const headerRight = navigationOptions?.['headerRight']
  const headerShown = navigationOptions?.['headerShown'] !== false
  const hasHeader = headerShown && !!(headerTitle || headerLeft || headerRight)

  const [backgroundRef, onMouseUp, onMouseDown] = useMouseClick(navigation, overlayNoClose)

  const [topMostModal, setTopMostModal] = React.useState(true)

  C.Router2.useSafeFocusEffect(() => {
    setTopMostModal(true)
    return () => {
      setTopMostModal(false)
    }
  })

  React.useEffect(() => {
    if (!topMostModal || overlayNoClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        navigation.pop()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [topMostModal, overlayNoClose, navigation])

  const titleNode = typeof headerTitle === 'function'
    ? headerTitle({children: typeof navigationOptions?.['title'] === 'string' ? navigationOptions['title'] : '', tintColor: ''})
    : headerTitle
  const leftNode = typeof headerLeft === 'function' ? headerLeft({canGoBack: true}) : undefined
  const rightNode = typeof headerRight === 'function' ? headerRight({tintColor: ''}) : undefined

  return (
    <Kb.Box2
      key="background"
      direction="horizontal"
      fullHeight={true}
      ref={backgroundRef}
      style={Kb.Styles.collapseStyles([
        styles.overlayContainer,
        overlayTransparent && styles.overlayTransparent,
        !topMostModal && styles.hidden,
      ])}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {overlayAvoidTabs && (
        <Kb.Box2 direction="vertical" className="tab-container" style={styles.overlayAvoidTabs} />
      )}
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.overlayStyle, overlayStyle])}>
        <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.modalBox, modalStyle])}>
          {hasHeader ? <ModalHeader title={titleNode} leftButton={leftNode} rightButton={rightNode} /> : null}
          {children}
          {modalFooter ? <ModalFooter {...modalFooter} wide={false} fullscreen={false} /> : null}
          {!overlayTransparent && !overlayNoClose && (
            <Kb.Icon
              type="iconfont-close"
              onClick={() => navigation.pop()}
              color={Kb.Styles.globalColors.whiteOrWhite_75}
              hoverColor={Kb.Styles.globalColors.white_40OrWhite_40}
              style={styles.closeIcon}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
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

    let body = children

    if (isModal) {
      body = (
        <ModalWrapper navigation={navigation} navigationOptions={navigationOptions}>
          {body}
        </ModalWrapper>
      )
    }

    body = <React.Suspense>{body}</React.Suspense>

    if (wrapInStrict(route.name)) {
      body = <React.StrictMode>{body}</React.StrictMode>
    }

    return body
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  closeIcon: Kb.Styles.platformStyles({
    isElectron: {
      cursor: 'pointer',
      padding: Kb.Styles.globalMargins.tiny,
      position: 'absolute',
      right: Kb.Styles.globalMargins.tiny * -4,
      top: 0,
    },
  }),
  hidden: {display: 'none'},
  modalBox: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      height: 560,
      pointerEvents: 'auto',
      position: 'relative',
      width: 400,
    },
  }),
  overlayAvoidTabs: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: undefined,
      height: 0,
      pointerEvents: 'none',
    },
  }),
  overlayContainer: {
    ...Kb.Styles.globalStyles.fillAbsolute,
  },
  overlayStyle: Kb.Styles.platformStyles({
    isElectron: {flexGrow: 1, pointerEvents: 'none'},
  }),
  overlayTransparent: {backgroundColor: undefined},
}))
