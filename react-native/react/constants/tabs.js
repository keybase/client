'use strict'

export const startupTab = 'startupTab'
export const folderTab = 'folderTab'
export const chatTab = 'chatTab'
export const peopleTab = 'peopleTab'
export const devicesTab = 'devicesTab'
export const moreTab = 'moreTab'

const prettyNames = {
  [startupTab]: null,
  [folderTab]: 'Folder',
  [chatTab]: 'Chat',
  [peopleTab]: 'People',
  [devicesTab]: 'Devices',
  [moreTab]: 'More'
}

export function prettify (tabName) {
  return prettyNames[tabName] || 'You have found a bug'
}
