// @flow

import type {Props as IconProps} from '../common-adapters/icon'

export const startupTab = 'tabs:startupTab'
export const chatTab = 'tabs:chatTab'
export const loginTab = 'tabs:loginTab'

type ProfileTab = 'tabs:profile'
export const profileTab = 'tabs:profile'
type PeopleTab = 'tabs:peopleTab'
export const peopleTab = 'tabs:peopleTab'
type DevicesTab = 'tabs:devicesTab'
export const devicesTab = 'tabs:devicesTab'
type FolderTab = 'tabs:folderTab'
export const folderTab = 'tabs:folderTab'
type MoreTab = 'tabs:moreTab'
export const moreTab = 'tabs:moreTab'

const prettyNames = {
  [startupTab]: null,
  [folderTab]: 'Folder',
  [chatTab]: 'Chat',
  [peopleTab]: 'People',
  [devicesTab]: 'Devices',
  [moreTab]: 'More',
  [loginTab]: 'Login',
  [profileTab]: 'Profile'
}

export type VisibleTab = ProfileTab | PeopleTab | FolderTab | DevicesTab | MoreTab

export function prettify (tabName: string) {
  return prettyNames[tabName] || 'You have found a bug'
}

const icons: {[key: VisibleTab]: IconProps.type} = {
  [peopleTab]: 'fa-users',
  [folderTab]: 'fa-folder',
  [devicesTab]: 'phone-bw-m',
  [moreTab]: 'fa-cog'
}

export function tabToIcon (t: VisibleTab): IconProps.type {
  return icons[t]
}
