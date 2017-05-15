// @flow
import {isMobile} from './platform'

const chatTab = 'tabs:chatTab'
const devicesTab = 'tabs:devicesTab'
const folderTab = 'tabs:folderTab'
const loginTab = 'tabs:loginTab'
const peopleTab = 'tabs:peopleTab'
const profileTab = 'tabs:profileTab'
const searchTab = 'tabs:searchTab'
const settingsTab = 'tabs:settingsTab'

type ChatTab = 'tabs:chatTab'
type DevicesTab = 'tabs:devicesTab'
type FolderTab = 'tabs:folderTab'
type LoginTab = 'tabs:loginTab'
type PeopleTab = 'tabs:peopleTab'
type ProfileTab = 'tabs:profileTab'
type SearchTab = 'tabs:searchTab'
type SettingsTab = 'tabs:settingsTab'

export type Tab =
  | ChatTab
  | DevicesTab
  | FolderTab
  | LoginTab
  | PeopleTab
  | ProfileTab
  | SettingsTab
  | SearchTab

function isValidInitialTab(tab: ?Tab) {
  if (isMobile) {
    return [chatTab, folderTab, profileTab, searchTab, settingsTab].includes(
      tab
    )
  } else {
    return [
      chatTab,
      folderTab,
      profileTab,
      devicesTab,
      searchTab,
      settingsTab,
    ].includes(tab)
  }
}

export {
  chatTab,
  devicesTab,
  folderTab,
  isValidInitialTab,
  loginTab,
  peopleTab,
  profileTab,
  searchTab,
  settingsTab,
}
