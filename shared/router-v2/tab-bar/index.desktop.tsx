import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import * as Platforms from '../../constants/platform'
import * as FsConstants from '../../constants/fs'
import * as Container from '../../util/container'
import * as Kbfs from '../../fs/common'
import RuntimeStats from '../../app/runtime-stats'
import './tab-bar.css'
import flags from '../../util/feature-flags'
import AccountSwitcher from '../account-switcher/container'

export type Props = {
  badgeNumbers: Map<Tabs.Tab, number>
  fsCriticalUpdate: boolean
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
  [Tabs.cryptoTab]: {icon: 'iconfont-nav-2-crypto', label: 'Crypto'},
  [Tabs.devicesTab]: {icon: 'iconfont-nav-2-devices', label: 'Devices'},
  [Tabs.fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [Tabs.gitTab]: {icon: 'iconfont-nav-2-git', label: 'Git'},
  [Tabs.peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [Tabs.settingsTab]: {icon: 'iconfont-nav-2-settings', label: 'Settings'},
  [Tabs.teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},
  [Tabs.walletsTab]: {icon: 'iconfont-nav-2-wallets', label: 'Wallet'},
} as const

const tabs = Tabs.desktopTabOrder.filter(tab => (tab === Tabs.cryptoTab ? flags.cryptoTab : true))

type State = {
  showingMenu: boolean
}

const FilesTabBadge = () => {
  const uploadIcon = FsConstants.getUploadIconForFilesTab(Container.useSelector(state => state.fs.badge))
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

  private keysMap = Tabs.desktopTabOrder.reduce((map, tab, index) => {
    map[`${Platforms.isDarwin ? 'command' : 'ctrl'}+${index + 1}`] = tab
    return map
  }, {})
  private hotKeys = Object.keys(this.keysMap)
  private onHotKey = (cmd: string) => {
    this.props.onTabClick(this.keysMap[cmd])
  }

  render() {
    const p = this.props
    return (
      !!p.username && (
        <Kb.Box2 className="tab-container" direction="vertical" fullHeight={true}>
          <Kb.Box2 direction="vertical" style={styles.header} fullWidth={true}>
            <Kb.HotKey hotKeys={this.hotKeys} onHotKey={this.onHotKey} />
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
              key={t}
              tab={t}
              index={i}
              selectedTab={p.selectedTab}
              onTabClick={p.onTabClick}
              badge={
                t === Tabs.fsTab && p.fsCriticalUpdate
                  ? (p.badgeNumbers.get(t) ?? 0) + 1
                  : p.badgeNumbers.get(t)
              }
            />
          ))}
          <RuntimeStats />
        </Kb.Box2>
      )
    )
  }
}

type TabProps = {
  tab: Tabs.AppTab
  index: number
  selectedTab: Tabs.Tab
  onTabClick: (t: Tabs.AppTab) => void
  badge?: number
}

type AnimationState = 'none' | 'encrypt' | 'decrypt'

const Tab = React.memo(({tab, index, selectedTab, onTabClick, badge}: TabProps) => {
  const [hovering, setHovering] = React.useState(false)
  const isCrypto = tab === Tabs.cryptoTab
  const tabData = data[tab]
  const {label} = tabData
  const labelLength = label.length - 1

  const [animationState, setAnimationState] = React.useState<AnimationState>('none')
  // left of divider is 'normal'
  const [divider, setDivider] = React.useState(-1)

  Kb.useInterval(
    () => {
      if (animationState === 'encrypt') {
        if (divider >= 0) {
          setDivider(divider - 1)
        } else {
          setAnimationState('none')
        }
      } else if (animationState === 'decrypt') {
        if (divider < labelLength) {
          setDivider(divider + 1)
        } else {
          setAnimationState('none')
        }
      }
    },
    animationState === 'none' ? undefined : 50
  )

  React.useEffect(() => {
    if (!isCrypto) return
    setAnimationState(hovering ? 'decrypt' : 'encrypt')
  }, [isCrypto, hovering])

  let animatedLabel: string | React.ReactNode
  if (isCrypto) {
    const parts = label.split('')
    const decrypted = parts.slice(0, divider + 1)
    const encrypted = parts.slice(divider + 1)
    animatedLabel = (
      <Kb.Text type="BodySmallSemibold">
        <Kb.Text type="BodySmallSemibold" className="tab-label">
          {decrypted}
        </Kb.Text>
        <Kb.Text type="BodySmallSemibold" className="tab-encrypted">
          {encrypted}
        </Kb.Text>
      </Kb.Text>
    )
  } else {
    animatedLabel = label
  }

  return (
    <Kb.ClickableBox
      feedback={false}
      key={tab}
      onClick={() => onTabClick(tab)}
      onMouseOver={isCrypto ? () => setHovering(true) : undefined}
      onMouseLeave={isCrypto ? () => setHovering(false) : undefined}
    >
      <Kb.WithTooltip
        tooltip={`${label} (${Platforms.shortcutSymbol}${index + 1})`}
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
            {animatedLabel}
          </Kb.Text>
          {!!badge && <Kb.Badge className="tab-badge" badgeNumber={badge} />}
        </Kb.Box2>
      </Kb.WithTooltip>
    </Kb.ClickableBox>
  )
})

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

export default TabBar
