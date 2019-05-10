// @flow strict
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

function isValidInitialTab(tab: ?Tab) {
  return isValidInitialTabString(tab)
}

function isValidInitialTabString(tab: ?string) {
  // Keep this in left-to-right (for mobile) or top-to-bottom (for
  // desktop) order in the app.
  if (isMobile) {
    return [peopleTab, chatTab, teamsTab, settingsTab, fsTab].includes(tab)
  } else {
    return [peopleTab, chatTab, folderTab, teamsTab, devicesTab, settingsTab].includes(tab)
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
