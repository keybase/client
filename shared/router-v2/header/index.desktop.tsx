import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Platform from '@/constants/platform'
import SyncingFolders from './syncing-folders'
import KB2 from '@/util/electron'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import type {NativeStackHeaderProps} from '@react-navigation/native-stack'

const {closeWindow, minimizeWindow, toggleMaximizeWindow} = KB2.functions

type HeaderTitleProps = {
  children: React.ReactNode
  tintColor?: string
}

type RawOptions = {
  headerMode?: string
  title?: React.ReactNode
  headerTitle?: React.ReactNode | React.JSXElementConstructor<HeaderTitleProps & {params?: unknown}>
  headerLeft?: React.ReactNode | ((props: HeaderBackButtonProps) => React.ReactNode)
  headerRight?: React.ReactNode | ((p: {tintColor?: string}) => React.ReactNode)
  headerRightActions?: React.ReactNode | React.JSXElementConstructor<object>
  subHeader?: React.ReactNode | React.JSXElementConstructor<object>
  headerTransparent?: boolean
  headerShadowVisible?: boolean
  headerBottomStyle?: Kb.Styles.StylesCrossPlatform
  headerStyle?: Kb.Styles.CollapsibleStyle
}

type Options = {
  headerMode?: string
  title?: React.ReactNode
  headerTitle?: React.ReactNode
  headerLeft?: React.ReactNode | ((props: HeaderBackButtonProps) => React.ReactNode)
  headerRight?: React.ReactNode | ((p: {tintColor?: string}) => React.ReactNode)
  headerRightActions?: React.ReactNode
  subHeader?: React.ReactNode
  headerTransparent?: boolean
  headerShadowVisible?: boolean
  headerBottomStyle?: Kb.Styles.StylesCrossPlatform
  headerStyle?: Kb.Styles.CollapsibleStyle
}

// A mobile-like header for desktop

// Fix this as we figure out what this needs to be
type Props = {
  loggedIn: boolean
  options: Options
  back?: boolean
  style?: Kb.Styles._StylesCrossPlatform
  useNativeFrame: boolean
  params?: unknown
  isMaximized: boolean
  navigation: {
    pop: () => void
  }
}

const PlainTitle = ({title}: {title: React.ReactNode}) => (
  <Kb.Box2 direction="horizontal" style={styles.plainContainer}>
    <Kb.Text style={styles.plainText} type="Header">
      {title}
    </Kb.Text>
  </Kb.Box2>
)

const SystemButtons = ({isMaximized}: {isMaximized: boolean}) => {
  const onMinimize = () => {
    minimizeWindow?.()
  }
  const onToggleMaximizeWindow = () => {
    toggleMaximizeWindow?.()
  }
  const onCloseWindow = () => {
    closeWindow?.()
  }
  return (
    <Kb.Box2 direction="horizontal">
      <Kb.ClickableBox
        className="hover_background_color_black_05  color_black_50 hover_color_black"
        onClick={onMinimize}
        style={styles.appIconBox}
        direction="vertical"
      >
        <Kb.Icon color="inherit" onClick={onMinimize} style={styles.appIcon} type="iconfont-app-minimize" />
      </Kb.ClickableBox>
      <Kb.ClickableBox
        className="hover_background_color_black_05 color_black_50 hover_color_black"
        onClick={onToggleMaximizeWindow}
        style={styles.appIconBox}
        direction="vertical"
      >
        <Kb.Icon
          color="inherit"
          onClick={onToggleMaximizeWindow}
          style={styles.appIcon}
          type={isMaximized ? 'iconfont-app-un-maximize' : 'iconfont-app-maximize'}
        />
      </Kb.ClickableBox>
      <Kb.ClickableBox
        className="hover_background_color_red hover_color_white color_black_50"
        onClick={onCloseWindow}
        style={styles.appIconBox}
        direction="vertical"
      >
        <Kb.Icon color="inherit" onClick={onCloseWindow} style={styles.appIcon} type="iconfont-app-close" />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}

function DesktopHeader(p: Props) {
  const {back, navigation, options, loggedIn, useNativeFrame, isMaximized} = p
  const {headerMode, title, headerTitle, headerRight, headerRightActions, subHeader} = options
  const {headerTransparent, headerShadowVisible, headerBottomStyle, headerStyle, headerLeft} = options

  const pop = () => {
    if (back) {
      navigation.pop()
    }
  }

  if (headerMode === 'none') {
    return null
  }

  let titleNode: React.ReactNode | string = null
  if (title) {
    titleNode = <PlainTitle title={title} />
  }

  if (headerTitle) {
    titleNode = headerTitle
  }

  let rightActions: React.ReactNode = null
  if (headerRightActions) {
    rightActions = headerRightActions
  } else if (typeof headerRight === 'function') {
    rightActions = headerRight({tintColor: ''})
  } else if (headerRight) {
    rightActions = headerRight
  }

  const subHeaderNode = subHeader ?? null

  let style: Kb.Styles.StylesCrossPlatform = null
  if (headerTransparent) {
    style = {position: 'absolute'}
  }

  const showDivider = headerShadowVisible !== false
  const windowDecorationsAreNeeded = !Platform.isMac && !useNativeFrame

  // The whole header normally clears the system icons (traffic lights on Mac) because the left nav
  // bar pushes it down/right -- unless you're logged out, in which case there's no nav bar and the
  // header starts at the top-left corner, overlapping them. So, on Mac when logged out, render a top
  // strip so the back/title/actions row sits below the traffic lights.
  const loggedOutDarwin = !loggedIn && Platform.isDarwin
  const iconContainerStyle: Kb.Styles.StylesCrossPlatform = Kb.Styles.collapseStyles([
    styles.iconContainer,
    !back && styles.iconContainerInactive,
  ] as const)
  const iconColor = back
    ? Kb.Styles.globalColors.black_50
    : loggedIn
      ? Kb.Styles.globalColors.black_10
      : Kb.Styles.globalColors.transparent

  const popupAnchor = React.createRef<Kb.MeasureRef | null>()

  const defaultBackButton = (
    <Kb.ClickableBox
      className={Kb.Styles.classNames('hover_container', {
        hover_background_color_black_10: !!back,
      })}
      onClick={pop}
      style={iconContainerStyle}
      direction="vertical"
    >
      <Kb.Icon
        type="iconfont-arrow-left"
        color={iconColor}
        className={Kb.Styles.classNames({hover_contained_color_blackOrBlack: back})}
      />
    </Kb.ClickableBox>
  )

  // headerLeft === null -> no back button; a node/function -> the route owns the back affordance
  // (and its onClick, e.g. a flow cancel); undefined -> the default arrow that pops the stack.
  // The header is a window-drag region, so a route-supplied control must be marked clickable or the
  // OS drag swallows its clicks.
  let backButton: React.ReactNode
  if (headerLeft === null) {
    backButton = null
  } else if (typeof headerLeft === 'function') {
    backButton = <Kb.Box2 direction="vertical" style={styles.headerLeftClickable}>{headerLeft({tintColor: iconColor})}</Kb.Box2>
  } else if (headerLeft !== undefined) {
    backButton = <Kb.Box2 direction="vertical" style={styles.headerLeftClickable}>{headerLeft}</Kb.Box2>
  } else {
    backButton = defaultBackButton
  }

  // Logged out: a top strip that holds only the system buttons (or, on Mac, just reserves space so the
  // OS traffic lights have nothing beside them), then a row below with back on the left, title centered,
  // actions on the right. The side sections share the same flex so the title stays centered regardless
  // of their widths. Keeping the back/title/actions row in a fixed spot below the strip stops it from
  // jumping between screens.
  if (!loggedIn) {
    const showTopStrip = loggedOutDarwin || windowDecorationsAreNeeded
    return (
      <Kb.Box2
        noShrink={true}
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.headerContainer,
          showDivider && styles.headerBorder,
          style,
          headerStyle,
        ])}
      >
        {showTopStrip && (
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems="center"
            justifyContent="flex-end"
            style={styles.loggedOutTopStrip}
          >
            {windowDecorationsAreNeeded && <SystemButtons isMaximized={isMaximized} />}
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.singleRow}>
          <Kb.Box2 direction="horizontal" flex={1} alignItems="center" justifyContent="flex-start">
            {backButton}
          </Kb.Box2>
          {headerTitle ? (
            titleNode
          ) : (
            <Kb.Text type="Header" lineClamp={1}>
              {title}
            </Kb.Text>
          )}
          <Kb.Box2
            direction="horizontal"
            flex={1}
            alignItems="center"
            justifyContent="flex-end"
            style={styles.headerLeftClickable}
          >
            {rightActions}
          </Kb.Box2>
        </Kb.Box2>
        {subHeaderNode}
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
      <Kb.Box2
        noShrink={true}
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.headerContainer,
          showDivider && styles.headerBorder,
          style,
          headerStyle,
        ])}
      >
        <Kb.Box2
          key="topBar"
          direction="horizontal"
          fullWidth={true}
          style={styles.headerBack}
          alignItems="center"
          ref={popupAnchor}
        >
          {/* TODO have headerLeft be the back button */}
          {backButton}
          <Kb.Box2 direction="horizontal" flex={1} justifyContent="flex-end">
            <SyncingFolders
              negative={
                p.style?.backgroundColor !== Kb.Styles.globalColors.transparent &&
                p.style?.backgroundColor !== Kb.Styles.globalColors.white
              }
            />
            {!title && rightActions}
            {windowDecorationsAreNeeded && <SystemButtons isMaximized={isMaximized} />}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          key="bottomBar"
          direction="horizontal"
          fullWidth={true}
          style={Kb.Styles.collapseStyles([styles.bottom, headerBottomStyle])}
        >
          <Kb.Box2 direction="horizontal" flex={1} overflow="hidden" style={styles.bottomTitle}>
            {titleNode}
          </Kb.Box2>
          {!!title && rightActions}
        </Kb.Box2>
      </Kb.Box2>
      {subHeaderNode}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      appIcon: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          padding: Kb.Styles.globalMargins.xtiny,
          position: 'relative',
          top: Kb.Styles.globalMargins.xxtiny,
        },
      }),
      appIconBox: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          padding: Kb.Styles.globalMargins.tiny,
          position: 'relative',
          right: -Kb.Styles.globalMargins.tiny,
          top: -Kb.Styles.globalMargins.xtiny,
        },
      }),
      bottom: {height: 40 - 1, maxHeight: 40 - 1}, // for border
      bottomTitle: {height: '100%', maxHeight: '100%'},
      headerBack: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          height: 40,
          justifyContent: 'space-between',
          padding: Kb.Styles.globalMargins.tiny,
        },
      }),
      headerBorder: {
        ...Kb.Styles.bottomDivider(),
      },
      headerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDragging,
          alignItems: 'center',
          containment: 'layout',
        },
      }),
      iconContainer: Kb.Styles.platformStyles({
        common: {
          // Needed to position blue badge
          position: 'relative',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          alignItems: 'center',
          borderRadius: Kb.Styles.borderRadius,
          marginLeft: 4,
          marginRight: 6,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      iconContainerInactive: Kb.Styles.platformStyles({
        isElectron: {cursor: 'default'},
      }),
      headerLeftClickable: Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable},
      }),
      loggedOutTopStrip: Kb.Styles.platformStyles({
        isElectron: {
          height: 28,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      singleRow: Kb.Styles.platformStyles({
        isElectron: {
          minHeight: 48,
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      plainContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        marginLeft: Kb.Styles.globalMargins.xsmall,
      },
      plainText: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
    }) as const
)

type HeaderProps = Omit<Props, 'back' | 'loggedIn' | 'useNativeFrame' | 'isMaximized'> & {
  back?: NativeStackHeaderProps['back']
  options: RawOptions
}

function DesktopHeaderWrapper(p: HeaderProps) {
  const {options: _options, back, style, params, navigation} = p
  const useNativeFrame = useShellState(s => s.useNativeFrame)
  const loggedIn = useConfigState(s => s.loggedIn)
  const isMaximized = useShellState(s => s.windowState.isMaximized)
  const {headerMode, title, headerTitle, headerRightActions, subHeader} = _options
  const {headerRight, headerTransparent, headerShadowVisible, headerBottomStyle, headerStyle, headerLeft} =
    _options
  let headerTitleNode = headerTitle
  if (typeof headerTitle === 'function') {
    const HeaderTitle = headerTitle as React.JSXElementConstructor<HeaderTitleProps & {params?: unknown}>
    headerTitleNode = <HeaderTitle params={params}>{title}</HeaderTitle>
  }

  let headerRightActionsNode = headerRightActions
  if (typeof headerRightActions === 'function') {
    const HeaderRightActions = headerRightActions as React.JSXElementConstructor<object>
    headerRightActionsNode = <HeaderRightActions />
  }

  let subHeaderNode = subHeader
  if (typeof subHeader === 'function') {
    const SubHeader = subHeader as React.JSXElementConstructor<object>
    subHeaderNode = <SubHeader />
  }
  const options = {
    headerBottomStyle,
    headerLeft,
    headerMode,
    headerRight,
    headerRightActions: headerRightActionsNode,
    headerShadowVisible,
    headerStyle,
    headerTitle: headerTitleNode,
    headerTransparent,
    subHeader: subHeaderNode,
    title,
  }

  return (
    <DesktopHeader
      useNativeFrame={useNativeFrame}
      loggedIn={loggedIn}
      key={String(isMaximized)}
      isMaximized={isMaximized}
      options={options}
      back={!!back /* not a bool upstream */}
      style={style}
      params={params}
      navigation={navigation}
    />
  )
}

export default DesktopHeaderWrapper
