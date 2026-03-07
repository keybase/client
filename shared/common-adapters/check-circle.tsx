import './check-circle.css'
import * as Styles from '@/styles'
import Icon2 from './icon2'

const Kb = {Icon2}

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
  const onClick = () => {
    if (props.onCheck) {
      !props.disabled && props.onCheck(!props.checked)
    }
  }

  return (
    <Kb.Icon2
      type={props.checked ? 'iconfont-success' : 'iconfont-circle'}
      onClick={onClick}
      fontSize={props.fontSize}
      color={
        props.disabled
          ? props.disabledColor || Styles.globalColors.black_05OrWhite_10
          : props.checked
            ? props.checkedColor || Styles.globalColors.blue
            : props.color || Styles.globalColors.black_20OrWhite_20
      }
      hoverColor={
        props.disabled
          ? props.disabledColor || Styles.globalColors.black_05OrWhite_10
          : props.checked
            ? props.checkedHoverColor || Styles.globalColors.blueDarkOrBlueLight
            : props.hoverColor || Styles.globalColors.blue
      }
      className={Styles.classNames(props.disabled && `checkCircle__disabled`, props.className)}
      style={props.style}
    />
  )
}

export default CheckCircle
