import {isMobile} from './platform'

type ChatTab = 'tabs.chatTab'
type DevicesTab = 'tabs.devicesTab'
type FolderTab = 'tabs.folderTab'
type LoginTab = 'tabs.loginTab'
type PeopleTab = 'tabs.peopleTab'
type SearchTab = 'tabs.searchTab'
type SettingsTab = 'tabs.settingsTab'
type TeamsTab = 'tabs.teamsTab'
type FsTab = 'tabs.fsTab'
type GitTab = 'tabs.gitTab'
type WalletsTab = 'tabs.walletsTab'

export type Tab =
  | ChatTab
  | DevicesTab
  | FolderTab
  | LoginTab
  | PeopleTab
  | SettingsTab
  | SearchTab
  | TeamsTab
  | GitTab
  | FsTab
  | WalletsTab

const chatTab: Tab & AppTab = 'tabs.chatTab'
const devicesTab: Tab & AppTab = 'tabs.devicesTab'
const folderTab: Tab = 'tabs.folderTab'
const loginTab: Tab = 'tabs.loginTab'
const peopleTab: Tab & AppTab = 'tabs.peopleTab'
const searchTab: Tab = 'tabs.searchTab'
const settingsTab: Tab & AppTab = 'tabs.settingsTab'
const teamsTab: Tab & AppTab = 'tabs.teamsTab'
const gitTab: Tab & AppTab = 'tabs.gitTab'
const fsTab: Tab & AppTab = 'tabs.fsTab'
const walletsTab: Tab & AppTab = 'tabs.walletsTab'

export type AppTab = PeopleTab | ChatTab | FsTab | TeamsTab | WalletsTab | GitTab | DevicesTab | SettingsTab

// Canonical ordering for desktop tabs, used visually and for hotkeys
const desktopTabOrder = [
  peopleTab,
  chatTab,
  fsTab,
  teamsTab,
  walletsTab,
  gitTab,
  devicesTab,
  settingsTab,
].filter(Boolean)

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
