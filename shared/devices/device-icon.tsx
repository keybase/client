import * as Kb from '../common-adapters'
import type * as Types from '../constants/types/devices'
import type * as ProvisionTypes from '../constants/types/provision'
import * as Constants from '../constants/devices'
import type {IconStyle} from '../common-adapters/icon'

export type Props = {
  current?: boolean
  device: Types.Device | ProvisionTypes.Device
  size: 32 | 64 | 96
  style?: IconStyle
}
const DeviceIcon = (props: Props) => {
  const defaultIcons = {
    backup: `icon-paper-key-${props.size}` as Kb.IconType,
    desktop: `icon-computer-${props.size}` as Kb.IconType,
    mobile: `icon-phone-${props.size}` as Kb.IconType,
  }

  const {type, deviceNumberOfType} = props.device
  const iconNumber = (deviceNumberOfType % Constants.numBackgrounds) + 1
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
