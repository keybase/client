import * as Platforms from './platform'

export * from './waiting-keys'

export const usernameHint =
  'Usernames must be 2-16 characters, and can only contain letters, numbers, and underscores.'
export const noEmail = 'NOEMAIL'

export const defaultDevicename =
  (isAndroid ? 'Android Device' : undefined) ||
  (isIOS ? 'iOS Device' : undefined) ||
  (Platforms.isDarwin ? 'Mac Device' : undefined) ||
  (Platforms.isWindows ? 'Windows Device' : undefined) ||
  (Platforms.isLinux ? 'Linux Device' : undefined) ||
  (isMobile ? 'Mobile Device' : 'Home Computer')
