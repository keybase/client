import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'

const Kb = {Icon}

type Props = {
  onCheck: ((newCheckedValue: boolean) => void) | null
  checked: boolean
  className?: string
  disabled?: boolean
  fontSize?: number
  style?: Styles.StylesCrossPlatform
}

const CheckCircle = (props: Props) => (
  <Kb.Icon
    type={props.checked ? 'iconfont-success' : 'iconfont-circle'}
    color={
      !props.disabled && (props.checked || Styles.isMobile)
        ? Styles.globalColors.blue
        : Styles.globalColors.black_20
    }
    onClick={props.disabled ? null : () => props.onCheck && props.onCheck(!props.checked)}
    fontSize={props.fontSize}
    className={Styles.classNames(!props.disabled && 'checkCircle', props.className)}
    style={props.style}
  />
)
export default CheckCircle
