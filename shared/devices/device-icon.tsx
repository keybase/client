import type * as Provision from '@/stores/provision'
import * as Devices from '@/stores/devices'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import type {IconStyle} from '@/common-adapters/icon'

export type Props = {
  current?: boolean
  device: T.Devices.Device | Provision.Device
  size: 32 | 64 | 96
  style?: IconStyle
}
const DeviceIcon = (props: Props) => {
  const defaultIcons = {
    backup: `icon-paper-key-${props.size}`,
    desktop: `icon-computer-${props.size}`,
    mobile: `icon-phone-${props.size}`,
  } as const

  const {type, deviceNumberOfType} = props.device
  const iconNumber = ((deviceNumberOfType % Devices.numBackgrounds) + 1) as T.Devices.IconNumber
  const badge = props.current ? 'success-' : ''

  const maybeIcon = (
    {
      backup: `icon-paper-key-${props.size}`,
      desktop: `icon-computer-${badge}background-${iconNumber}-${props.size}`,
      mobile: `icon-phone-${badge}background-${iconNumber}-${props.size}`,
    } as const
  )[type]
  const icon: Kb.IconType = Kb.isValidIconType(maybeIcon) ? maybeIcon : defaultIcons[type]

  return <Kb.Icon type={icon} style={props.style} />
}
export default DeviceIcon
