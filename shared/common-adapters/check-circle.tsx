import './check-circle.css'
import * as Styles from '@/styles'
import Icon from './icon'

const Kb = {Icon}

type Props = {
  color?: Styles.Color
  hoverColor?: Styles.Color

  checked: boolean
  checkedColor?: Styles.Color
  checkedHoverColor?: Styles.Color

  disabled?: boolean
  disabledColor?: Styles.Color

  className?: string
  fontSize?: number
  onCheck?: (newCheckedValue: boolean) => void
  style?: Styles.StylesCrossPlatform
}

const CheckCircle = (props: Props) => {
  const {
    checked,
    checkedColor,
    checkedHoverColor,
    className,
    color,
    disabled,
    disabledColor,
    fontSize,
    hoverColor,
    onCheck,
    style,
  } = props
  const onClick = () => {
    if (onCheck) {
      if (!disabled) {
        onCheck(!checked)
      }
    }
  }

  return (
    <Kb.Icon
      type={checked ? 'iconfont-success' : 'iconfont-circle'}
      onClick={onClick}
      fontSize={fontSize}
      color={
        disabled
          ? disabledColor || Styles.globalColors.black_05OrWhite_10
          : checked
            ? checkedColor || Styles.globalColors.blue
            : color || Styles.globalColors.black_20OrWhite_20
      }
      hoverColor={
        disabled
          ? disabledColor || Styles.globalColors.black_05OrWhite_10
          : checked
            ? checkedHoverColor || Styles.globalColors.blueDarkOrBlueLight
            : hoverColor || Styles.globalColors.blue
      }
      className={Styles.classNames(disabled && `checkCircle__disabled`, className)}
      style={style}
    />
  )
}

export default CheckCircle
