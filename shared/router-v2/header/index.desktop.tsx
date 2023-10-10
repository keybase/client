import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Platform from '../../constants/platform'
import SyncingFolders from './syncing-folders'
import {IconWithPopup as WhatsNewIconWithPopup} from '../../whats-new/icon/container'
// @ts-ignore
import * as ReactIs from 'react-is'
import KB2 from '../../util/electron.desktop'

const {closeWindow, minimizeWindow, toggleMaximizeWindow} = KB2.functions

// A mobile-like header for desktop

// Fix this as we figure out what this needs to be
type Props = {
  loggedIn: boolean
  options: {
    headerMode?: string
    title?: React.ReactNode
    headerTitle?: React.ReactNode
    headerLeft?: React.ReactNode
    headerRightActions?: React.JSXElementConstructor<{}>
    subHeader?: React.JSXElementConstructor<{}>
    headerTransparent?: boolean
    headerHideBorder?: boolean
    headerBottomStyle?: Kb.Styles.StylesCrossPlatform
    headerStyle?: Kb.Styles.StylesCrossPlatform
  }
  back?: boolean
  style?: any
  useNativeFrame: boolean
  params?: unknown
  isMaximized: boolean
  navigation: {
    pop: () => void
  }
}

const PlainTitle = ({title}: {title: any}) => (
  <Kb.Box2 direction="horizontal" style={styles.plainContainer}>
    <Kb.Text style={styles.plainText} type="Header">
      {title}
    </Kb.Text>
  </Kb.Box2>
)

export const SystemButtons = ({isMaximized}: {isMaximized: boolean}) => (
  <Kb.Box2 direction="horizontal">
    <Kb.ClickableBox
      className="hover_background_color_black_05  color_black_50 hover_color_black"
      onClick={minimizeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon
        inheritColor={true}
        onClick={minimizeWindow}
        style={styles.appIcon}
        type="iconfont-app-minimize"
      />
    </Kb.ClickableBox>
    <Kb.ClickableBox
      className="hover_background_color_black_05 color_black_50 hover_color_black"
      onClick={toggleMaximizeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon
        inheritColor={true}
        onClick={toggleMaximizeWindow}
        style={styles.appIcon}
        type={isMaximized ? 'iconfont-app-un-maximize' : 'iconfont-app-maximize'}
      />
    </Kb.ClickableBox>
    <Kb.ClickableBox
      className="hover_background_color_red hover_color_white color_black_50"
      onClick={closeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon inheritColor={true} onClick={closeWindow} style={styles.appIcon} type="iconfont-app-close" />
    </Kb.ClickableBox>
  </Kb.Box2>
)

const DesktopHeader = React.memo(
  function DesktopHeader(p: Props) {
    const {back, navigation, options, loggedIn, useNativeFrame, params, isMaximized} = p

    const pop = React.useCallback(() => {
      back && navigation.pop()
    }, [back, navigation])

    // TODO add more here as we use more options on the mobile side maybe
    const opt = options
    if (opt.headerMode === 'none') {
      return null
    }

    let title: React.ReactNode | string = null
    if (opt.title) {
      title = <PlainTitle title={opt.title} />
    }

    if (opt.headerTitle) {
      if (React.isValidElement(opt.headerTitle)) {
        title = opt.headerTitle
      } else if (ReactIs.isValidElementType(opt.headerTitle)) {
        const CustomTitle = opt.headerTitle as any
        title = <CustomTitle params={params}>{opt.title}</CustomTitle>
      }
    }

    let rightActions: React.ReactNode = null
    if (ReactIs.isValidElementType(opt.headerRightActions)) {
      const CustomActions = opt.headerRightActions
      rightActions = CustomActions ? <CustomActions /> : null
    }

    let subHeader: React.ReactNode = null
    if (ReactIs.isValidElementType(opt.subHeader)) {
      const CustomSubHeader = opt.subHeader
      subHeader = CustomSubHeader ? <CustomSubHeader /> : null
    }

    let style: Kb.Styles.StylesCrossPlatform = null
    if (opt.headerTransparent) {
      style = {position: 'absolute'}
    }

    let showDivider = true
    if (opt.headerHideBorder) {
      showDivider = false
    }

    const windowDecorationsAreNeeded = !Platform.isMac && !useNativeFrame

    // We normally have the back arrow at the top of the screen. It doesn't overlap with the system
    // icons (minimize etc) because the left nav bar pushes it to the right -- unless you're logged
    // out, in which case there's no nav bar and they overlap. So, if we're on Mac, and logged out,
    // push the back arrow down below the system icons.
    const iconContainerStyle: Kb.Styles.StylesCrossPlatform = Kb.Styles.collapseStyles([
      styles.iconContainer,
      !back && styles.iconContainerInactive,
      !loggedIn && Platform.isDarwin && styles.iconContainerDarwin,
    ] as const)
    const iconColor = back
      ? Kb.Styles.globalColors.black_50
      : loggedIn
      ? Kb.Styles.globalColors.black_10
      : Kb.Styles.globalColors.transparent

    const whatsNewAttachToRef = React.createRef<Kb.MeasureRef>()

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
            opt.headerStyle,
          ])}
        >
          <Kb.Box2Measure
            key="topBar"
            direction="horizontal"
            fullWidth={true}
            style={styles.headerBack}
            alignItems="center"
            ref={whatsNewAttachToRef}
          >
            {/* TODO have headerLeft be the back button */}
            {opt.headerLeft !== null && (
              <Kb.Box
                className={Kb.Styles.classNames('hover_container', {
                  hover_background_color_black_10: !!back,
                })}
                onClick={pop}
                style={iconContainerStyle}
              >
                <Kb.Icon
                  type="iconfont-arrow-left"
                  color={iconColor}
                  className={Kb.Styles.classNames({hover_contained_color_blackOrBlack: back})}
                  boxStyle={styles.icon}
                />
              </Kb.Box>
            )}
            <Kb.Box2 direction="horizontal" style={styles.topRightContainer}>
              <SyncingFolders
                negative={
                  p.style?.backgroundColor !== Kb.Styles.globalColors.transparent &&
                  p.style?.backgroundColor !== Kb.Styles.globalColors.white
                }
              />
              {loggedIn && <WhatsNewIconWithPopup attachToRef={whatsNewAttachToRef} />}
              {!title && rightActions}
              {windowDecorationsAreNeeded && <SystemButtons isMaximized={isMaximized} />}
            </Kb.Box2>
          </Kb.Box2Measure>
          <Kb.Box2
            key="bottomBar"
            direction="horizontal"
            fullWidth={true}
            style={Kb.Styles.collapseStyles([styles.bottom, opt.headerBottomStyle])}
          >
            <Kb.Box2 direction="horizontal" style={styles.bottomTitle}>
              {title}
            </Kb.Box2>
            {!!title && rightActions}
          </Kb.Box2>
        </Kb.Box2>
        {subHeader}
      </Kb.Box2>
    )
  },
  (p, n) => {
    return C.shallowEqual(p, n, (obj, oth, key) => {
      if (key === 'options') {
        return C.shallowEqual(obj, oth)
      }
      return undefined
    })
  }
)

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
      bottomExpandable: {minHeight: 40 - 1},
      bottomTitle: {flexGrow: 1, height: '100%', maxHeight: '100%', overflow: 'hidden'},
      flexOne: {flex: 1},
      headerBack: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          height: 40,
          justifyContent: 'space-between',
          padding: Kb.Styles.globalMargins.tiny,
        },
      }),
      headerBorder: {
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
      },
      headerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDragging,
          alignItems: 'center',
          containment: 'layout',
        },
      }),
      icon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          height: 14,
          width: 14,
        },
      }),
      iconContainer: Kb.Styles.platformStyles({
        common: {
          // Needed to position blue badge
          position: 'relative',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          borderRadius: Kb.Styles.borderRadius,
          marginLeft: 4,
          marginRight: 6,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      iconContainerDarwin: Kb.Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: 30,
        },
      }),
      iconContainerInactive: Kb.Styles.platformStyles({
        isElectron: {cursor: 'default'},
      }),
      plainContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        marginLeft: Kb.Styles.globalMargins.xsmall,
      },
      plainText: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
      topRightContainer: {flex: 1, justifyContent: 'flex-end'},
    }) as const
)

type HeaderProps = Omit<Props, 'loggedIn' | 'useNativeFrame' | 'isMaximized'>

const DesktopHeaderWrapper = (p: HeaderProps) => {
  const {options, back, style, params, navigation} = p
  const useNativeFrame = C.useConfigState(s => s.useNativeFrame)
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const isMaximized = C.useConfigState(s => s.windowState.isMaximized)

  return (
    <DesktopHeader
      useNativeFrame={useNativeFrame}
      loggedIn={loggedIn}
      key={String(isMaximized)}
      isMaximized={isMaximized}
      options={options}
      back={back}
      style={style}
      params={params}
      navigation={navigation}
    />
  )
}

export default DesktopHeaderWrapper
