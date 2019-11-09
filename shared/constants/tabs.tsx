import {isMobile} from './platform'

const chatTab = 'tabs.chatTab'
const devicesTab = 'tabs.devicesTab'
const folderTab = 'tabs.folderTab'
const loginTab = 'tabs.loginTab'
const peopleTab = 'tabs.peopleTab'
const searchTab = 'tabs.searchTab'
const settingsTab = 'tabs.settingsTab'
const teamsTab = 'tabs.teamsTab'
const gitTab = 'tabs.gitTab'
const fsTab = 'tabs.fsTab'
const walletsTab = 'tabs.walletsTab'

export type Tab =
  | typeof chatTab
  | typeof devicesTab
  | typeof folderTab
  | typeof loginTab
  | typeof peopleTab
  | typeof settingsTab
  | typeof searchTab
  | typeof teamsTab
  | typeof gitTab
  | typeof fsTab
  | typeof walletsTab

export type AppTab =
  | typeof peopleTab
  | typeof chatTab
  | typeof fsTab
  | typeof teamsTab
  | typeof walletsTab
  | typeof gitTab
  | typeof devicesTab
  | typeof settingsTab

// Canonical ordering for desktop tabs, used visually and for hotkeys
const desktopTabOrder = Object.freeze(
  new Array<AppTab>(peopleTab, chatTab, fsTab, teamsTab, walletsTab, gitTab, devicesTab, settingsTab)
)

function isValidInitialTab(tab: Tab | null) {
  return isValidInitialTabString(tab)
}

function isValidInitialTabString(tab: string | null) {
  // Keep this in left-to-right (for mobile) or top-to-bottom (for
  // desktop) order in the app.
  if (isMobile) {
    return ([peopleTab, chatTab, teamsTab, settingsTab, fsTab] as Tab[]).includes(tab as Tab)
  } else {
    return [peopleTab, chatTab, folderTab, teamsTab, devicesTab, settingsTab].includes(tab as Tab)
  }
}

export {
  chatTab,
  desktopTabOrder,
  devicesTab,
  folderTab,
  fsTab,
  gitTab,
  isValidInitialTab,
  isValidInitialTabString,
  loginTab,
  peopleTab,
  searchTab,
  settingsTab,
  teamsTab,
  walletsTab,
}
