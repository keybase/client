import type * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
import Icon, {type SizeType} from './icon'
import ImageIcon from './image-icon'

export type IconAutoProps = {
  type: IconType
  style?: Styles.StylesCrossPlatform | undefined
  color?: Styles.Color | undefined
  fontSize?: number | undefined
  sizeType?: SizeType | undefined
  className?: string | undefined
  hoverColor?: Styles.Color | undefined
  onClick?: (() => void) | undefined
  padding?: keyof typeof Styles.globalMargins | undefined
}

const IconAuto = (props: IconAutoProps) => {
  const {type, style, className} = props
  if (iconMeta[type].isFont) {
    return <Icon {...props} />
  }
  return <ImageIcon type={type} style={style} className={className} />
}

export default IconAuto
