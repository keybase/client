import './check-circle.css'
import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'

const Kb = {Icon}

type Props = {
  onCheck?: (newCheckedValue: boolean) => void
  checked: boolean
  className?: string
  disabled?: boolean
  fontSize?: number
  selectedColor?: Styles.Color
  selectedHoverColor?: Styles.Color
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
  const [hover, setHover] = React.useState(false)
  const onMouseEnter = () => setHover(true)
  const onMouseLeave = () => setHover(false)

  return (
    <Kb.Icon
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      type={props.checked ? 'iconfont-success' : 'iconfont-circle'}
      colorOverride={
        props.disabled
          ? hover
            ? Styles.globalColors.black_20
            : Styles.globalColors.black_10
          : hover
          ? props.selectedHoverColor ?? Styles.globalColors.blueDark
          : props.selectedColor ?? Styles.globalColors.blue
      }
      onClick={onClick}
      fontSize={props.fontSize}
      className={Styles.classNames(props.disabled && 'checkCircle__disabled', props.className)}
      style={props.style}
    />
  )
}

export default CheckCircle
