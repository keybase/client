import type * as Provision from '@/stores/provision'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
export type Props = {
  current?: boolean
  device: T.Devices.Device | Provision.Device
  size: 32 | 64 | 96
  style?: Kb.Styles.StylesCrossPlatform
}
export const getDeviceIconType = (device: Props['device'], size: Props['size'], current?: boolean): Kb.IconType => {
  const defaultIcons = {
    backup: `icon-paper-key-${size}`,
    desktop: `icon-computer-${size}`,
    mobile: `icon-phone-${size}`,
  } as const
  const {type, deviceNumberOfType} = device
  const iconNumber = T.Devices.deviceNumberToIconNumber(deviceNumberOfType)
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

const DeviceIcon = (props: Props) => {
  return <Kb.ImageIcon type={getDeviceIconType(props.device, props.size, props.current)} style={props.style} />
}
export default DeviceIcon
