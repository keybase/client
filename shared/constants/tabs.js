// @flow strict
import {isMobile} from './platform'

const chatTab = 'tabs:chatTab'
const devicesTab = 'tabs:devicesTab'
const folderTab = 'tabs:folderTab'
const loginTab = 'tabs:loginTab'
const peopleTab = 'tabs:peopleTab'
const profileTab = 'tabs:profileTab'
const searchTab = 'tabs:searchTab'
const settingsTab = 'tabs:settingsTab'
const teamsTab = 'tabs:teamsTab'
const gitTab = 'tabs:gitTab'
const fsTab = 'tabs:fsTab'
const walletsTab = 'tabs:walletsTab'

type ChatTab = 'tabs:chatTab'
type DevicesTab = 'tabs:devicesTab'
type FolderTab = 'tabs:folderTab'
type LoginTab = 'tabs:loginTab'
type PeopleTab = 'tabs:peopleTab'
type ProfileTab = 'tabs:profileTab'
type SearchTab = 'tabs:searchTab'
type SettingsTab = 'tabs:settingsTab'
type TeamsTab = 'tabs:teamsTab'
type FsTab = 'tabs:fsTab'
type GitTab = 'tabs:gitTab'
type WalletsTab = 'tabs:walletsTab'

export type Tab =
  | ChatTab
  | DevicesTab
  | FolderTab
  | LoginTab
  | PeopleTab
  | ProfileTab
  | SettingsTab
  | SearchTab
  | TeamsTab
  | GitTab
  | FsTab
  | WalletsTab

function isValidInitialTab(tab: ?Tab) {
  return isValidInitialTabString(tab)
}

function isValidInitialTabString(tab: ?string) {
  // Keep this in left-to-right (for mobile) or top-to-bottom (for
  // desktop) order in the app.
  if (isMobile) {
    return [peopleTab, chatTab, teamsTab, settingsTab].includes(tab)
  } else {
    return [peopleTab, chatTab, folderTab, teamsTab, devicesTab, settingsTab, profileTab].includes(tab)
  }
}

export {
  chatTab,
  devicesTab,
  folderTab,
  fsTab,
  gitTab,
  isValidInitialTab,
  isValidInitialTabString,
  loginTab,
  peopleTab,
  profileTab,
  searchTab,
  settingsTab,
  teamsTab,
  walletsTab,
}
