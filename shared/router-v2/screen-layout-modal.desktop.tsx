import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import type {GetOptionsRet} from '@/constants/types/router'
import type {ParamListBase} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

type ModalHeaderProps = {
  title?: React.ReactNode
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
}

const ModalHeader = (props: ModalHeaderProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="horizontal" alignItems="center" fullHeight={true} flex={1}>
      <Kb.Box2 direction="horizontal" flex={1} style={styles.headerLeft}>
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
      <Kb.Box2 direction="horizontal" flex={1} style={styles.headerRight}>
        {!!props.rightButton && props.rightButton}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const mouseResetValue = -9999
const mouseDistanceThreshold = 5

const useMouseClick = (navigation: NativeStackNavigationProp<ParamListBase>, noClose?: boolean) => {
  const backgroundRef = React.useRef<HTMLDivElement>(null)
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

export type ModalWrapperProps = {
  children: React.ReactNode
  navigationOptions?: GetOptionsRet
  navigation: NativeStackNavigationProp<ParamListBase>
}

export const ModalWrapper = (p: ModalWrapperProps) => {
  const {navigationOptions, navigation, children} = p
  const {overlayAvoidTabs, overlayTransparent, overlayNoClose, modalSize} = navigationOptions ?? {}

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

  const titleNode =
    typeof headerTitle === 'function'
      ? headerTitle({
          children:
            typeof navigationOptions?.['title'] === 'string' ? navigationOptions['title'] : '',
          tintColor: '',
        })
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
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          styles.overlayStyle,
          modalSize === 'fullscreen' && styles.overlayStretch,
        ])}
      >
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([
            styles.modalBox,
            modalSize === 'wide' && styles.sizeWide,
            modalSize === 'fullscreen' && styles.sizeFullscreen,
            !modalSize && styles.sizeDefault,
          ])}
        >
          {hasHeader ? <ModalHeader title={titleNode} leftButton={leftNode} rightButton={rightNode} /> : null}
          {children}
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
    ...Kb.Styles.bottomDivider(48),
  },
  headerLeft: {
    justifyContent: 'flex-start',
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
  },
  headerRight: {
    justifyContent: 'flex-end',
    ...Kb.Styles.paddingH(Kb.Styles.globalMargins.xsmall),
  },
  hidden: {display: 'none'},
  modalBox: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      pointerEvents: 'auto',
      position: 'relative',
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
  overlayStretch: {alignSelf: 'stretch'},
  overlayStyle: Kb.Styles.platformStyles({
    isElectron: {...Kb.Styles.centered(), flexGrow: 1, pointerEvents: 'none'},
  }),
  overlayTransparent: {backgroundColor: undefined},
  sizeDefault: Kb.Styles.platformStyles({isElectron: {maxHeight: 560, width: 400}}),
  sizeFullscreen: Kb.Styles.platformStyles({isElectron: {height: '80%', width: '80%'}}),
  sizeWide: Kb.Styles.platformStyles({isElectron: {height: 560, width: 560}}),
}))
