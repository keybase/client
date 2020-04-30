import './check-circle.css'
import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'

const Kb = {Icon}

/*
  If you'd like to add a new color variant, add it to the palette below and use
  its key as the "color" prop.
*/
const palette = {
  default: {
    dark: {
      base: Styles.globalColors.black_20,
      checked: Styles.globalColors.blue,
      checkedHover: Styles.globalColors.blueLight,
      disabledBase: Styles.globalColors.black_20,
      disabledHover: Styles.globalColors.black_35,
      hover: Styles.globalColors.blue,
    },
    light: {
      base: Styles.globalColors.black_10,
      checked: Styles.globalColors.blue,
      checkedHover: Styles.globalColors.blueDark,
      disabledBase: Styles.globalColors.black_10,
      disabledHover: Styles.globalColors.black_20,
      hover: Styles.globalColors.blue,
    },
  },
}
export type Color = keyof typeof palette

type Props = {
  color?: Color
  checked: boolean
  className?: string
  disabled?: boolean
  fontSize?: number
  onCheck?: (newCheckedValue: boolean) => void
  style?: Styles.StylesCrossPlatform
}

const CheckCircle = (props: Props) => {
  const onClick = (evt: React.BaseSyntheticEvent) => {
    if (props.onCheck) {
      !props.disabled && props.onCheck(!props.checked)
      evt.preventDefault()
      evt.stopPropagation()
    }
  }

  const colors = palette[props.color || 'default'][Styles.isDarkMode() ? 'dark' : 'light']

  return (
    <Kb.Icon
      type={props.checked ? 'iconfont-success' : 'iconfont-circle'}
      onClick={onClick}
      fontSize={props.fontSize}
      color={props.disabled ? colors.disabledBase : props.checked ? colors.checked : colors.base}
      hoverColor={props.disabled ? colors.disabledHover : props.checked ? colors.checkedHover : colors.hover}
      className={Styles.classNames(props.disabled && `checkCircle__disabled`, props.className)}
      style={props.style}
    />
  )
}

export default CheckCircle
