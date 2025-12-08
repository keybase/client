import * as Platforms from './platform'

export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const addEmailWaitingKey = 'settings:addEmail'
export const importContactsWaitingKey = 'settings:importContacts'

export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'
export const waitingKey = 'signup:waiting'

export const defaultDevicename =
  (Platforms.isAndroid ? 'Android Device' : undefined) ||
  (Platforms.isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (Platforms.isMobile ? 'Mobile Device' : 'Home Computer')
