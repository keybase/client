import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Platform from '../../constants/platform'
import * as WalletsConstants from '../../constants/wallets'
import * as Styles from '../../styles'
import * as Window from '../../util/window-management'
import {BrowserWindow} from '../../util/safe-electron.desktop'
import AirdropBanner from '../../wallets/airdrop/banner/container'
import SyncingFolders from './syncing-folders'
import {IconWithPopup as WhatsNewIconWithPopup} from '../../whats-new/icon/container'
import flags from '../../util/feature-flags'
import * as ReactIs from 'react-is'

// A mobile-like header for desktop

// Fix this as we figure out what this needs to be
type Props = {
  allowBack: boolean
  airdropWillShowBanner: boolean
  loggedIn: boolean
  onPop: () => void
  options: any
  style?: any
  useNativeFrame: boolean
}

const PlainTitle = ({title}) => (
  <Kb.Box2 direction="horizontal" style={styles.plainContainer}>
    <Kb.Text style={styles.plainText} type="Header">
      {title}
    </Kb.Text>
  </Kb.Box2>
)

export const SystemButtons = () => (
  <Kb.Box2 direction="horizontal">
    <Kb.ClickableBox
      className="hover_background_color_black_05  color_black_50 hover_color_black"
      onClick={Window.minimizeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon
        inheritColor={true}
        onClick={Window.minimizeWindow}
        style={styles.appIcon}
        type="iconfont-app-minimize"
      />
    </Kb.ClickableBox>
    <Kb.ClickableBox
      className="hover_background_color_black_05 color_black_50 hover_color_black"
      onClick={Window.toggleMaximizeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon
        inheritColor={true}
        onClick={Window.toggleMaximizeWindow}
        style={styles.appIcon}
        type={Window.isMaximized() ? 'iconfont-app-un-maximize' : 'iconfont-app-maximize'}
      />
    </Kb.ClickableBox>
    <Kb.ClickableBox
      className="hover_background_color_red hover_color_white color_black_50"
      onClick={Window.closeWindow}
      style={styles.appIconBox}
    >
      <Kb.Icon
        inheritColor={true}
        onClick={Window.closeWindow}
        style={styles.appIcon}
        type="iconfont-app-close"
      />
    </Kb.ClickableBox>
  </Kb.Box2>
)

class Header extends React.PureComponent<Props> {
  componentDidMount() {
    this._registerWindowEvents()
  }
  componentWillUnmount() {
    this._unregisterWindowEvents()
  }
  _refreshWindowIcons = () => this.forceUpdate()
  // We need to forceUpdate when maximizing and unmaximizing the window to update the
  // app icon on Windows and Linux.
  _registerWindowEvents() {
    if (Platform.isDarwin) return
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    win.on('maximize', this._refreshWindowIcons)
    win.on('unmaximize', this._refreshWindowIcons)
  }
  _unregisterWindowEvents() {
    if (Platform.isDarwin) return
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    win.removeListener('maximize', this._refreshWindowIcons)
    win.removeListener('unmaximize', this._refreshWindowIcons)
  }
  render() {
    // TODO add more here as we use more options on the mobile side maybe
    const opt = this.props.options
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
        const CustomTitle = opt.headerTitle
        title = <CustomTitle>{opt.title}</CustomTitle>
      }
    }

    let rightActions: React.ReactNode = null
    if (ReactIs.isValidElementType(opt.headerRightActions)) {
      const CustomActions = opt.headerRightActions
      rightActions = <CustomActions />
    }

    let subHeader: React.ReactNode = null
    if (ReactIs.isValidElementType(opt.subHeader)) {
      const CustomSubHeader = opt.subHeader
      subHeader = <CustomSubHeader />
    }

    let style: Styles.StylesCrossPlatform = null
    if (opt.headerTransparent) {
      style = {position: 'absolute'}
    }

    let showDivider = true
    if (opt.headerHideBorder) {
      showDivider = false
    }

    // Normally this component is responsible for rendering the system buttons,
    // but if we're showing a banner then that banner component needs to do it.
    const windowDecorationsAreNeeded = !Platform.isMac && !this.props.useNativeFrame
    const windowDecorationsDrawnByBanner =
      windowDecorationsAreNeeded && flags.airdrop && this.props.loggedIn && this.props.airdropWillShowBanner

    // We normally have the back arrow at the top of the screen. It doesn't overlap with the system
    // icons (minimize etc) because the left nav bar pushes it to the right -- unless you're logged
    // out, in which case there's no nav bar and they overlap. So, if we're on Mac, and logged out,
    // push the back arrow down below the system icons.
    const iconContainerStyle = Styles.collapseStyles([
      styles.iconContainer,
      !this.props.allowBack && styles.iconContainerInactive,
      !this.props.loggedIn && Platform.isDarwin && styles.iconContainerDarwin,
    ])
    const iconColor =
      opt.headerBackIconColor ||
      (this.props.allowBack
        ? Styles.globalColors.black_50
        : this.props.loggedIn
        ? Styles.globalColors.black_10
        : Styles.globalColors.transparent)

    const whatsNewAttachToRef = React.createRef<Kb.Box2>()

    return (
      <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
        <Kb.Box2
          noShrink={true}
          direction="vertical"
          fullWidth={true}
          style={Styles.collapseStyles([
            styles.headerContainer,
            showDivider && styles.headerBorder,
            style,
            opt.headerStyle,
          ])}
        >
          {flags.airdrop && this.props.loggedIn && (
            <AirdropBanner showSystemButtons={windowDecorationsDrawnByBanner} />
          )}
          <Kb.Box2
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
                className={Styles.classNames('hover_container', {
                  hover_background_color_black_10: this.props.allowBack,
                })}
                onClick={this.props.allowBack ? this.props.onPop : null}
                style={iconContainerStyle}
              >
                <Kb.Icon
                  type="iconfont-arrow-left"
                  color={iconColor}
                  className={Styles.classNames({hover_contained_color_blackOrBlack: this.props.allowBack})}
                  boxStyle={styles.icon}
                />
              </Kb.Box>
            )}
            <Kb.Box2 direction="horizontal" style={styles.topRightContainer}>
              <SyncingFolders
                negative={
                  this.props.style &&
                  this.props.style.backgroundColor &&
                  this.props.style.backgroundColor !== Styles.globalColors.transparent &&
                  this.props.style.backgroundColor !== Styles.globalColors.white
                }
              />
              {this.props.loggedIn && (
                <WhatsNewIconWithPopup
                  color={opt.whatsNewIconColor}
                  badgeColor={opt.whatsNewIconColor}
                  attachToRef={whatsNewAttachToRef}
                />
              )}
              {!title && rightActions}
              {windowDecorationsAreNeeded && !windowDecorationsDrawnByBanner && <SystemButtons />}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2
            key="bottomBar"
            direction="horizontal"
            fullWidth={true}
            style={Styles.collapseStyles([
              opt.headerExpandable ? styles.bottomExpandable : styles.bottom,
              opt.headerBottomStyle,
            ])}
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
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      appIcon: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
          padding: Styles.globalMargins.xtiny,
          position: 'relative',
          top: Styles.globalMargins.xxtiny,
        },
      }),
      appIconBox: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
          padding: Styles.globalMargins.tiny,
          position: 'relative',
          right: -Styles.globalMargins.tiny,
          top: -Styles.globalMargins.xtiny,
        },
      }),
      bottom: {height: 40 - 1, maxHeight: 40 - 1}, // for border
      bottomExpandable: {minHeight: 40 - 1},
      bottomTitle: {flexGrow: 1, height: '100%', maxHeight: '100%', overflow: 'hidden'},
      flexOne: {
        flex: 1,
      },
      headerBack: Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          height: 40,
          justifyContent: 'space-between',
          padding: Styles.globalMargins.tiny,
        },
      }),
      headerBorder: {
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
      },
      headerContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDragging,
          alignItems: 'center',
        },
      }),
      icon: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          height: 14,
          width: 14,
        },
      }),
      iconContainer: Styles.platformStyles({
        common: {
          // Needed to position blue badge
          position: 'relative',
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
          ...Styles.desktopStyles.windowDraggingClickable,
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          borderRadius: Styles.borderRadius,
          marginLeft: 4,
          marginRight: 6,
          padding: Styles.globalMargins.xtiny,
        },
      }),
      iconContainerDarwin: Styles.platformStyles({
        isElectron: {
          position: 'relative',
          top: 30,
        },
      }),
      iconContainerInactive: Styles.platformStyles({
        isElectron: {
          cursor: 'default',
        },
      }),
      plainContainer: {
        ...Styles.globalStyles.flexGrow,
        marginLeft: Styles.globalMargins.xsmall,
      },
      plainText: {
        ...Styles.globalStyles.flexGrow,
      },
      topRightContainer: {flex: 1, justifyContent: 'flex-end'},
    } as const)
)

const mapStateToProps = (state: Container.TypedState) => ({
  airdropWillShowBanner: WalletsConstants.getShowAirdropBanner(state),
  useNativeFrame: state.config.useNativeFrame,
})

const mapDispatchToProps = () => ({})

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: any) => ({
  ...s,
  ...d,
  ...o,
}))(Header)
