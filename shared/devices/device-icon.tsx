import type * as Provision from '@/stores/provision'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
export type Props = {
  current?: boolean
  device: T.Devices.Device | Provision.Device
  size: 32 | 64 | 96
  style?: Kb.Styles.StylesCrossPlatform
}
export const getDeviceIconType = (
  type: T.Devices.DeviceType,
  iconNumber: T.Devices.IconNumber,
  size: 32 | 64 | 96,
  current?: boolean
): Kb.IconType => {
  const defaultIcons = {
    backup: `icon-paper-key-${size}`,
    desktop: `icon-computer-${size}`,
    mobile: `icon-phone-${size}`,
  } as const
  const badge = current ? 'success-' : ''
  const maybeIcon = (
    {
      backup: `icon-paper-key-${size}`,
      desktop: `icon-computer-${badge}background-${iconNumber}-${size}`,
      mobile: `icon-phone-${badge}background-${iconNumber}-${size}`,
    } as const
  )[type]
  return Kb.isValidIconType(maybeIcon) ? maybeIcon : defaultIcons[type]
}

export const getDeviceRevokeIconType = (
  type: T.Devices.DeviceType,
  iconNumber: T.Devices.IconNumber
): Kb.IconType => {
  const size = isMobile ? 64 : 48
  if (type === 'backup') return `icon-paper-key-revoke-${size}` as Kb.IconType
  const maybeIcon = (
    {
      desktop: `icon-computer-revoke-background-${iconNumber}-${size}`,
      mobile: `icon-phone-revoke-background-${iconNumber}-${size}`,
    } as const
  )[type]
  const fallback = ({
    desktop: `icon-computer-revoke-${size}`,
    mobile: `icon-phone-revoke-${size}`,
  } as const)[type]
  return Kb.isValidIconType(maybeIcon) ? maybeIcon : fallback
}

const DeviceIcon = ({current, device, size, style}: Props) => (
  <Kb.ImageIcon
    type={getDeviceIconType(device.type, T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType), size, current)}
    style={style}
  />
)
export default DeviceIcon
