import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'
import {Color} from '../styles'

const Kb = {Icon}

type Props = {
  onCheck?: (newCheckedValue: boolean) => void
  checked: boolean
  className?: string
  disabled?: boolean
  fontSize?: number
  selectedColor?: Color
  style?: Styles.StylesCrossPlatform
}

const CheckCircle = (props: Props) => {
  return (
    <Kb.Icon
      type={props.checked ? 'iconfont-success' : 'iconfont-circle'}
      color={
        props.disabled
          ? Styles.globalColors.black_10
          : props.checked
          ? props.selectedColor ?? Styles.globalColors.blue
          : Styles.globalColors.black_20
      }
      onClick={props.disabled || !props.onCheck ? null : () => props.onCheck!(!props.checked)}
      fontSize={props.fontSize}
      className={Styles.classNames(!props.disabled && 'checkCircle', props.className)}
      style={props.style}
    />
  )
}
export default CheckCircle
