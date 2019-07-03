import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import KeyHandler from '../../util/key-handler.desktop'
import {isDarwin} from '../../constants/platform'
import './tab-bar.css'

type Props = {
  badgeNumbers: {[K in string]: number}
  fullname: string
  isWalletsNew?: boolean
  onHelp: () => void
  onProfileClick: () => void
  onQuit: () => void
  onSettings: () => void
  onSignOut: () => void
  onTabClick: (tab: Tabs.AppTab) => void
  selectedTab: Tabs.Tab
  uploading: boolean
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

class TabBar extends React.PureComponent<Props, State> {
  state = {showingMenu: false}

  _attachmentRef = React.createRef<Kb.Box2>()
  _getAttachmentRef = () => this._attachmentRef.current
  _showMenu = () => this.setState({showingMenu: true})
  _hideMenu = () => this.setState({showingMenu: false})
  _menuHeader = () => ({
    onClick: this.props.onProfileClick,
    title: '',
    view: (
      <Kb.Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true}>
        <Kb.ConnectedNameWithIcon
          username={this.props.username}
          onClick={() => {
            this._hideMenu()
            this.props.onProfileClick()
          }}
          metaTwo={
            <Kb.Text type="BodySmall" lineClamp={1}>
              {this.props.fullname}
            </Kb.Text>
          }
        />
      </Kb.Box2>
    ),
  })
  _menuItems = () =>
    [
      {
        onClick: this.props.onProfileClick,
        title: 'View profile',
      },
      'Divider',
      {
        onClick: this.props.onSettings,
        title: 'Settings',
      },
      {
        onClick: this.props.onHelp,
        title: 'Help',
      },
      {
        danger: true,
        onClick: this.props.onSignOut,
        title: 'Sign out',
      },
      {
        danger: true,
        onClick: this.props.onQuit,
        title: 'Quit Keybase',
      },
    ] as const

  render() {
    const p = this.props
    return (
      !!p.username && (
        <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
          <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
            <Kb.Box2 direction="horizontal" style={styles.osButtons} fullWidth={true} />
            <Kb.ClickableBox onClick={this._showMenu}>
              <Kb.Box2
                direction="horizontal"
                gap="tiny"
                centerChildren={true}
                fullWidth={true}
                style={styles.nameContainer}
                alignItems="center"
                ref={this._attachmentRef}
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
              header={this._menuHeader()}
              closeOnSelect={true}
              visible={this.state.showingMenu}
              attachTo={this._getAttachmentRef}
              items={this._menuItems()}
              onHidden={this._hideMenu}
            />
          </Kb.Box2>
          {tabs.map(t => (
            <Kb.ClickableBox key={t} onClick={() => p.onTabClick(t)}>
              <Kb.WithTooltip text={data[t].label} toastClassName="tab-tooltip">
                <Kb.Box2
                  direction="horizontal"
                  fullWidth={true}
                  className={t === p.selectedTab ? 'tab-selected' : 'tab'}
                  style={styles.tab}
                >
                  <Kb.Box2 className="tab-highlight" direction="vertical" fullHeight={true} />
                  <Kb.Box2 style={styles.iconBox} direction="horizontal">
                    <Kb.Icon className="tab-icon" type={data[t].icon} sizeType="Big" />
                    {p.uploading && t === Tabs.fsTab && (
                      <Kb.Icon
                        type={'icon-addon-file-uploading'}
                        sizeType={'Default'}
                        style={styles.badgeIcon}
                      />
                    )}
                  </Kb.Box2>
                  <Kb.Text className="tab-label" type="BodySmallSemibold">
                    {data[t].label}
                  </Kb.Text>
                  {!!p.badgeNumbers[t] && <Kb.Badge className="tab-badge" badgeNumber={p.badgeNumbers[t]} />}
                </Kb.Box2>
              </Kb.WithTooltip>
            </Kb.ClickableBox>
          ))}
        </Kb.Box2>
      )
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatar: {marginLeft: 14},
  badgeIcon: {
    bottom: -4,
    position: 'absolute',
    right: 8,
  },
  caret: {marginRight: 12},
  divider: {marginTop: Styles.globalMargins.tiny},
  header: {height: 80, marginBottom: 20},
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
})

const keysMap = Tabs.desktopTabOrder.reduce((map, tab, index) => {
  map[`${isDarwin ? 'command' : 'ctrl'}+${index + 1}`] = tab
  return map
}, {})
const hotkeys = Object.keys(keysMap)

const InsideHotKeyTabBar = KeyHandler(TabBar)

class HotKeyTabBar extends React.Component<Props> {
  _onHotkey = cmd => {
    this.props.onTabClick(keysMap[cmd])
  }
  render() {
    return <InsideHotKeyTabBar {...this.props} hotkeys={hotkeys} onHotkey={this._onHotkey} />
  }
}

export default HotKeyTabBar
