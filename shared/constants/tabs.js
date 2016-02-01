export const startupTab = 'tabs:startupTab'
export const folderTab = 'tabs:folderTab'
export const chatTab = 'tabs:chatTab'
export const peopleTab = 'tabs:peopleTab'
export const devicesTab = 'tabs:devicesTab'
export const moreTab = 'tabs:moreTab'
export const loginTab = 'tabs:loginTab'

const prettyNames = {
  [startupTab]: null,
  [folderTab]: 'Folder',
  [chatTab]: 'Chat',
  [peopleTab]: 'People',
  [devicesTab]: 'Devices',
  [moreTab]: 'More',
  [loginTab]: 'Login'
}

export function prettify (tabName) {
  return prettyNames[tabName] || 'You have found a bug'
}
