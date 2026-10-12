import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as C from '@/constants'
import type {GetOptionsRet, ModalSize} from '@/constants/types/router'
import type {ParamListBase} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {getTextStyle} from '@/common-adapters/text.styles'

type ModalHeaderProps = {
  // the route's headerStyle, for a colored header
  style?: Kb.Styles.StylesCrossPlatform
  title?: React.ReactNode
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
}

export const ModalHeader = (props: ModalHeaderProps) => {
  const {style, title, leftButton, rightButton} = props
  const styles = useStyles()
  const isStringTitle = typeof title === 'string'
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} noShrink={true} style={Kb.Styles.collapseStyles([styles.header, style])}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullHeight={true} flex={1}>
        <Kb.Box2 direction="horizontal" flex={1} style={styles.headerLeft}>
          {!!leftButton && leftButton}
        </Kb.Box2>
        {/* a title component that renders bare text inherits the Header style from this box;
            Kb.Text children set their own and are unaffected */}
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.title, !isStringTitle && styles.componentTitle])}
        >
          {isStringTitle ? (
            <Kb.Text type="Header" lineClamp={1} center={true}>
              {title}
            </Kb.Text>
          ) : (
            title
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" flex={1} style={styles.headerRight}>
          {!!rightButton && rightButton}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

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

// small sizes to its content up to the cap; medium and large are fixed, so a list body can fill them
export const modalSizeStyles = {
  large: {height: '80%', width: '80%'},
  medium: {height: 'min(560px, 85vh)', width: 560},
  small: {maxHeight: 'min(560px, 85vh)', width: 400},
} as const satisfies Record<ModalSize, React.CSSProperties>

export type ModalWrapperProps = {
  // the root-stack route below this one is a modal, so a header Back leads to it
  canGoBack: boolean
  children: React.ReactNode
  navigationOptions?: GetOptionsRet
  navigation: NativeStackNavigationProp<ParamListBase>
}

export const ModalWrapper = (p: ModalWrapperProps) => {
  const {canGoBack, navigationOptions, navigation, children} = p
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {overlayAvoidTabs, overlayTransparent, overlayNoClose, modalSize = 'small'} = navigationOptions ?? {}

  const headerTitle = navigationOptions?.['headerTitle'] ?? navigationOptions?.['title']
  const headerLeft = navigationOptions?.['headerLeft']
  const headerRight = navigationOptions?.['headerRight']
  const headerShown = navigationOptions?.['headerShown'] !== false
  const hasHeader = headerShown && !!(headerTitle || headerLeft || headerRight)

  const [backgroundRef, onMouseUp, onMouseDown] = useMouseClick(navigation, overlayNoClose)

  const [topMostModal, setTopMostModal] = React.useState(true)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setTopMostModal(true)
      return () => {
        setTopMostModal(false)
      }
    }, [])
  )

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

  const modalBox = {size: modalSize}

  const titleNode =
    typeof headerTitle === 'function'
      ? headerTitle({
          children:
            typeof navigationOptions?.['title'] === 'string' ? navigationOptions['title'] : '',
          tintColor: '',
        })
      : headerTitle
  const leftNode = typeof headerLeft === 'function' ? headerLeft({canGoBack}) : undefined
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
        <Kb.Box2 alignSelf="center" direction="vertical" className="tab-container" style={styles.overlayAvoidTabs} />
      )}
      <Kb.Box2
        alignSelf="center"
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.overlayStyle, modalSize === 'large' && styles.overlayStretch])}
      >
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.modalFrame, modalSizeStyles[modalSize]])}
        >
          {/* clips the body to the rounded box; the close X sits outside the box, so it's a sibling */}
          <Kb.Box2 direction="vertical" style={styles.modalClip}>
            {hasHeader ? (
              <ModalHeader
                style={navigationOptions?.headerStyle}
                title={titleNode}
                leftButton={leftNode}
                rightButton={rightNode}
              />
            ) : null}
            {/* the area under the header, so a screen's 100% height is the body, not the whole box */}
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.modalBody}>
              <Kb.ModalBoxContext value={modalBox}>{children}</Kb.ModalBoxContext>
            </Kb.Box2>
          </Kb.Box2>
          {!overlayTransparent && !overlayNoClose && (
            <Kb.Icon
              type="iconfont-close"
              testID={TestIDs.MODAL_CLOSE}
              onClick={() => navigation.pop()}
              color={theme.whiteOrWhite_75}
              hoverColor={theme.white_40OrWhite_40}
              style={styles.closeIcon}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  closeIcon: Kb.Styles.platformStyles({
    isElectron: {
      cursor: 'pointer',
      padding: Kb.Styles.globalMargins.tiny,
      position: 'absolute',
      right: Kb.Styles.globalMargins.tiny * -4,
      top: 0,
    },
  }),
  componentTitle: getTextStyle('Header', theme),
  header: {
    ...Kb.Styles.bottomDivider(theme),
    height: 48,
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
  modalBody: {flexGrow: 1, flexShrink: 1, minHeight: 0},
  modalClip: Kb.Styles.platformStyles({
    isElectron: {
      borderRadius: Kb.Styles.borderRadius,
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      overflow: 'hidden',
    },
  }),
  modalFrame: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      backgroundColor: theme.white,
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
  title: {flexShrink: 1, minWidth: 0},
}))
