import type * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import * as Constants from '@/constants/devices'
import type {IconStyle} from '@/common-adapters/icon'

export type Props = {
  current?: boolean
  device: T.Devices.Device | C.Provision.Device
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
  const iconNumber = ((deviceNumberOfType % Constants.numBackgrounds) + 1) as T.Devices.IconNumber
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
