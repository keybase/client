'use strict'
export const STARTUP_TAB = 'STARTUP_TAB'
export const FOLDER_TAB = 'FOLDER_TAB'
export const CHAT_TAB = 'CHAT_TAB'
export const PEOPLE_TAB = 'PEOPLE_TAB'
export const DEVICES_TAB = 'DEVICES_TAB'
export const MORE_TAB = 'MORE_TAB'

const prettyNames = {
  [STARTUP_TAB]: null,
  [FOLDER_TAB]: 'Folder',
  [CHAT_TAB]: 'Chat',
  [PEOPLE_TAB]: 'People',
  [DEVICES_TAB]: 'Devices',
  [MORE_TAB]: 'More'
}

export function prettify (tabName) {
  return prettyNames[tabName] || 'You have found a bug'
}
