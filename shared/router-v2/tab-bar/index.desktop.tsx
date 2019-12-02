import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import * as Platforms from '../../constants/platform'
import * as FsConstants from '../../constants/fs'
import * as Kbfs from '../../fs/common'
import KeyHandler from '../../util/key-handler.desktop'
import RuntimeStats from '../../app/runtime-stats/container'
import './tab-bar.css'
import flags from '../../util/feature-flags'
import AccountSwitcher from '../account-switcher/container'

export type Props = {
  badgeNumbers: Map<Tabs.Tab, number>
  fullname: string
  isWalletsNew?: boolean
  onAddAccount: () => void
  onHelp: () => void
  onProfileClick: () => void
  onQuit: () => void
  onSettings: () => void
  onSignOut: () => void
  onTabClick: (tab: Tabs.AppTab) => void
  selectedTab: Tabs.Tab
  username: string
}

const data = {
  [Tabs.chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [Tabs.devicesTab]: {icon: 'iconfont-nav-2-devices', label: 'Devices'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.gitTab]: {icon: 'iconfont-nav-2-git', label: 'Git'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-settings', label: 'Settings'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
} as const

const tabs = Tabs.desktopTabOrder

type State = {
  showingMenu: boolean
}

const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Kbfs.useFsBadge())
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.badgeIconUpload} /> : null
}

class TabBar extends React.PureComponent<Props, State> {
  state = {showingMenu: false}

  private attachmentRef = React.createRef<Kb.Box2>()
  private getAttachmentRef = () => this.attachmentRef.current
  private showMenu = () => this.setState({showingMenu: true})
  private hideMenu = () => this.setState({showingMenu: false})
  private onClickWrapper = () => {
    this.hideMenu()
    this.props.onProfileClick()
  }
  private menuHeader = () => ({
    onClick: this.props.onProfileClick,
    title: '',
    view: (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ClickableBox onClick={this.onClickWrapper} style={styles.headerBox}>
          <Kb.ConnectedNameWithIcon
            username={this.props.username}
            onClick={this.onClickWrapper}
            metaTwo={
              <Kb.Text type="BodySmall" lineClamp={1} style={styles.fullname}>
                {this.props.fullname}
              </Kb.Text>
            }
          />
        </Kb.ClickableBox>
        <Kb.Button
          label="View/Edit profile"
          mode="Secondary"
          onClick={this.onClickWrapper}
          small={true}
          style={styles.button}
        />
        {flags.fastAccountSwitch && <AccountSwitcher />}
      </Kb.Box2>
    ),
  })
  private menuItems = (): Kb.MenuItems => [
    ...(flags.fastAccountSwitch
      ? [{onClick: this.props.onAddAccount, title: 'Log in as another user'}]
      : [{onClick: this.props.onProfileClick, title: 'View profile'}, 'Divider' as const]),
    {onClick: this.props.onSettings, title: 'Settings'},
    {onClick: this.props.onHelp, title: 'Help'},
    {danger: true, onClick: this.props.onSignOut, title: 'Sign out'},
    {danger: true, onClick: this.props.onQuit, title: 'Quit Keybase'},
  ]

  render() {
    const p = this.props
    return (
      !!p.username && (
        <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
          <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
            <Kb.Box2 direction="horizontal" style={styles.osButtons} fullWidth={true} />
            <Kb.ClickableBox onClick={this.showMenu}>
              <Kb.Box2
                direction="horizontal"
                gap="tiny"
                centerChildren={true}
                fullWidth={true}
                style={styles.nameContainer}
                alignItems="center"
                ref={this.attachmentRef}
              >
                <Kb.Avatar
                  size={24}
                  borderColor={Styles.globalColors.blue}
                  username={p.username}
                  style={styles.avatar}
                />
                <>
                  <Kb.Text className="username" lineClamp={1} type="BodyTinySemibold" style={styles.username}>
                    Hi {p.username}!
                  </Kb.Text>
                  <Kb.Icon
                    type="iconfont-arrow-down"
                    color={Styles.globalColors.blueLighter}
                    fontSize={12}
                    style={styles.caret}
                  />
                </>
              </Kb.Box2>
            </Kb.ClickableBox>
            <Kb.Divider style={styles.divider} />
            <Kb.FloatingMenu
              position="bottom left"
              containerStyle={styles.menu}
              header={this.menuHeader()}
              closeOnSelect={true}
              visible={this.state.showingMenu}
              attachTo={this.getAttachmentRef}
              items={this.menuItems()}
              onHidden={this.hideMenu}
            />
          </Kb.Box2>
          {tabs.map((t, i) => (
            <Tab
              tab={t}
              index={i}
              selectedTab={p.selectedTab}
              onTabClick={p.onTabClick}
              badge={p.badgeNumbers.get(t)}
            />
          ))}
          <RuntimeStats />
        </Kb.Box2>
      )
    )
  }
}

const Tab = React.memo(({tab, index, selectedTab, onTabClick, badge}) => (
  <Kb.ClickableBox key={tab} onClick={() => onTabClick(tab)}>
    <Kb.WithTooltip
      tooltip={`${data[tab].label} (${Platforms.shortcutSymbol}${index + 1})`}
      toastClassName="tab-tooltip"
    >
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        className={tab === selectedTab ? 'tab-selected' : 'tab'}
        style={styles.tab}
      >
        <Kb.Box2 className="tab-highlight" direction="vertical" fullHeight={true} />
        <Kb.Box2 style={styles.iconBox} direction="horizontal">
          <Kb.Icon className="tab-icon" type={data[tab].icon} sizeType="Big" />
          {tab === Tabs.fsTab && <FilesTabBadge />}
        </Kb.Box2>
        <Kb.Text className="tab-label" type="BodySmallSemibold">
          {data[tab].label}
        </Kb.Text>
        {!!badge && <Kb.Badge className="tab-badge" badgeNumber={badge} />}
      </Kb.Box2>
    </Kb.WithTooltip>
  </Kb.ClickableBox>
))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatar: {marginLeft: 14},
      badgeIcon: {
        bottom: -4,
        position: 'absolute',
        right: 8,
      },
      badgeIconUpload: {
        bottom: -Styles.globalMargins.xxtiny,
        height: Styles.globalMargins.xsmall,
        position: 'absolute',
        right: Styles.globalMargins.xsmall,
        width: Styles.globalMargins.xsmall,
      },
      button: {
        margin: Styles.globalMargins.xsmall,
      },
      caret: {marginRight: 12},
      divider: {marginTop: Styles.globalMargins.tiny},
      fullname: {maxWidth: 180},
      header: {flexShrink: 0, height: 80, marginBottom: 20},
      headerBox: {
        paddingTop: Styles.globalMargins.small,
      },
      iconBox: {
        justifyContent: 'flex-end',
        position: 'relative',
      },
      menu: {marginLeft: Styles.globalMargins.tiny},
      nameContainer: {height: 24},
      osButtons: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDragging,
          flexGrow: 1,
        },
      }),
      tab: {
        alignItems: 'center',
        paddingRight: 12,
        position: 'relative',
      },
      username: Styles.platformStyles({
        isElectron: {color: Styles.globalColors.blueLighter, flexGrow: 1, wordBreak: 'break-all'},
      }),
    } as const)
)

const keysMap = Tabs.desktopTabOrder.reduce((map, tab, index) => {
  map[`${Platforms.isDarwin ? 'command' : 'ctrl'}+${index + 1}`] = tab
  return map
}, {})
const hotkeys = Object.keys(keysMap)

const InsideHotKeyTabBar = KeyHandler(TabBar)

class HotKeyTabBar extends React.PureComponent<Props> {
  private onHotkey = (cmd: string) => {
    this.props.onTabClick(keysMap[cmd])
  }
  private onProfileClick = () => {
    this.props.onProfileClick()
  }
  private onTabClick = (t: Tabs.AppTab) => {
    this.props.onTabClick(t)
  }
  render() {
    return (
      <InsideHotKeyTabBar
        {...this.props}
        hotkeys={hotkeys}
        onHotkey={this.onHotkey}
        onProfileClick={this.onProfileClick}
        onTabClick={this.onTabClick}
      />
    )
  }
}

export default HotKeyTabBar
