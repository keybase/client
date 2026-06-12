import type * as Provision from '@/stores/provision'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
export type Props = {
  current?: boolean
  device: T.Devices.Device | Provision.Device
  size: 32 | 64 | 96
  style?: Kb.Styles.StylesCrossPlatform
}
const getIconType = (
  type: T.Devices.DeviceType,
  iconNumber: T.Devices.IconNumber,
  size: 32 | 48 | 64 | 96,
  variant: '' | 'success-' | 'revoke-'
): Kb.IconType => {
  const revoke = variant === 'revoke-' ? variant : ''
  if (type === 'backup') return `icon-paper-key-${revoke}${size}` as Kb.IconType
  const base = type === 'desktop' ? 'computer' : 'phone'
  const maybeIcon = `icon-${base}-${variant}background-${iconNumber}-${size}`
  return Kb.isValidIconType(maybeIcon) ? maybeIcon : (`icon-${base}-${revoke}${size}` as Kb.IconType)
}

export const getDeviceIconType = (
  type: T.Devices.DeviceType,
  iconNumber: T.Devices.IconNumber,
  size: 32 | 64 | 96,
  current?: boolean
): Kb.IconType => getIconType(type, iconNumber, size, current ? 'success-' : '')

export const getDeviceRevokeIconType = (
  type: T.Devices.DeviceType,
  iconNumber: T.Devices.IconNumber
): Kb.IconType => getIconType(type, iconNumber, isMobile ? 64 : 48, 'revoke-')

const DeviceIcon = ({current, device, size, style}: Props) => (
  <Kb.ImageIcon
    type={getDeviceIconType(device.type, T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType), size, current)}
    style={style}
  />
)
export default DeviceIcon
