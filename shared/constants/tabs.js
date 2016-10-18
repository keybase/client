// @flow
type StartupTab = 'tabs:startupTab'
export const startupTab = 'tabs:startupTab'
type ChatTab = 'tabs:chatTab'
export const chatTab = 'tabs:chatTab'
type LoginTab = 'tabs:loginTab'
export const loginTab = 'tabs:loginTab'

type ProfileTab = 'tabs:profileTab'
export const profileTab = 'tabs:profileTab'
type PeopleTab = 'tabs:peopleTab'
export const peopleTab = 'tabs:peopleTab'
type DevicesTab = 'tabs:devicesTab'
export const devicesTab = 'tabs:devicesTab'
type FolderTab = 'tabs:folderTab'
export const folderTab = 'tabs:folderTab'
type SearchTab = 'tabs:searchTab'
export const searchTab = 'tabs:searchTab'
type SettingsTab = 'tabs:settingsTab'
export const settingsTab = 'tabs:settingsTab'

const prettyNames = {
  [startupTab]: null,
  [folderTab]: 'Folders',
  [chatTab]: 'Chat',
  [peopleTab]: 'People',
  [devicesTab]: 'Devices',
  [settingsTab]: 'Settings',
  [loginTab]: 'Login',
  [profileTab]: 'Profile',
}

export type Tab = ChatTab
| DevicesTab
| FolderTab
| LoginTab
| PeopleTab
| ProfileTab
| SettingsTab
| SearchTab
