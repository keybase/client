import type * as NotificationTypes from '../constants/types/notifications'
import {isDarwin, isWindows, isLinux} from '../constants/platform'

const getIcons = (iconType: NotificationTypes.BadgeType, isBadged: boolean, isSystemDarkMode: boolean) => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  const badged = isBadged ? 'badged-' : ''
  let platform = ''

  if (isDarwin) {
    color = isSystemDarkMode ? 'white' : 'black'
  } else if (isWindows) {
    color = 'black'
    platform = 'windows-'
  }

  const size = isWindows ? 16 : 22
  const x = isLinux ? '' : '@2x'
  return `icon-${platform}keybase-menubar-${badged}${iconType}-${color}-${size}${devMode}${x}.png`
}

export default getIcons
