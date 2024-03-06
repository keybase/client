export const chatTab = 'tabs.chatTab'
export const cryptoTab = 'tabs.cryptoTab'
export const devicesTab = 'tabs.devicesTab'
export const loginTab = 'tabs.loginTab'
export const peopleTab = 'tabs.peopleTab'
export const searchTab = 'tabs.searchTab'
export const settingsTab = 'tabs.settingsTab'
export const teamsTab = 'tabs.teamsTab'
export const gitTab = 'tabs.gitTab'
export const fsTab = 'tabs.fsTab'

export type Tab =
  | typeof chatTab
  | typeof cryptoTab
  | typeof devicesTab
  | typeof loginTab
  | typeof peopleTab
  | typeof settingsTab
  | typeof searchTab
  | typeof teamsTab
  | typeof gitTab
  | typeof fsTab

export type AppTab =
  | typeof peopleTab
  | typeof chatTab
  | typeof cryptoTab
  | typeof fsTab
  | typeof teamsTab
  | typeof gitTab
  | typeof devicesTab
  | typeof settingsTab

// Canonical ordering for desktop tabs, used visually and for hotkeys
export const desktopTabs = [
  peopleTab,
  chatTab,
  fsTab,
  cryptoTab,
  teamsTab,
  gitTab,
  devicesTab,
  settingsTab,
] as const
export const phoneTabs = [peopleTab, chatTab, fsTab, teamsTab, settingsTab] as const
export const tabletTabs = [peopleTab, chatTab, fsTab, teamsTab, settingsTab] as const

export const desktopTabMeta = {
  [chatTab]: {icon: 'iconfont-nav-2-chat', label: 'Chat'},
  [cryptoTab]: {icon: 'iconfont-nav-2-crypto', label: 'Crypto'},
  [devicesTab]: {icon: 'iconfont-nav-2-devices', label: 'Devices'},
  [fsTab]: {icon: 'iconfont-nav-2-files', label: 'Files'},
  [gitTab]: {icon: 'iconfont-nav-2-git', label: 'Git'},
  [peopleTab]: {icon: 'iconfont-nav-2-people', label: 'People'},
  [settingsTab]: {icon: 'iconfont-nav-2-settings', label: 'Settings'},
  [teamsTab]: {icon: 'iconfont-nav-2-teams', label: 'Teams'},

  // eslint-disable-next-line
  [loginTab]: undefined,
  [searchTab]: undefined,
} as const
