import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import type {GetOptions, GetOptionsParams, GetOptionsRet} from '@/constants/types/router'
import type {ParamListBase} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type ModalHeaderProps = {
  title?: React.ReactNode
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
}

const ModalHeader = (props: ModalHeaderProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="horizontal" alignItems="center" fullHeight={true} style={Kb.Styles.globalStyles.flexOne}>
      <Kb.Box2 direction="horizontal" style={styles.headerLeft}>
        {!!props.leftButton && props.leftButton}
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        {typeof props.title === 'string' ? (
          <Kb.Text type="Header" lineClamp={1} center={true}>
            {props.title}
          </Kb.Text>
        ) : (
          props.title
        )}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" style={styles.headerRight}>
        {!!props.rightButton && props.rightButton}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

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
  navigation: NativeStackNavigationProp<ParamListBase, string>
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
          {modalFooter ? (
            <Kb.Box2
              direction="vertical"
              centerChildren={true}
              fullWidth={true}
              style={Kb.Styles.collapseStyles([
                modalFooter.hideBorder ? styles.modalFooterNoBorder : styles.modalFooter,
                modalFooter.style,
              ])}
            >
              {modalFooter.content}
            </Kb.Box2>
          ) : null}
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

export const makeLayout = (isModal: boolean, _isLoggedOut: boolean, _isTabScreen: boolean, getOptions?: GetOptions) => {
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
  header: {
    borderBottomColor: Kb.Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid' as const,
    minHeight: 48,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    paddingRight: Kb.Styles.globalMargins.xsmall,
  },
  headerRight: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    paddingRight: Kb.Styles.globalMargins.xsmall,
  },
  hidden: {display: 'none'},
  modalBox: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      maxHeight: 560,
      pointerEvents: 'auto',
      position: 'relative',
      width: 400,
    },
  }),
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  modalFooterNoBorder: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
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
    isElectron: {alignItems: 'center', flexGrow: 1, justifyContent: 'center', pointerEvents: 'none'},
  }),
  overlayTransparent: {backgroundColor: undefined},
}))
