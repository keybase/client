import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'
import {Color} from '../styles'

const Kb = {Icon}

type Props = {
  onCheck: ((newCheckedValue: boolean) => void) | null
  checked: boolean
  className?: string
  disabled?: boolean
  fontSize?: number
  selectedColor?: Color
}

const CheckCircle = (props: Props) => {
  const [checked, setChecked] = React.useState(props.checked)
  const onClick = () => {
    const newChecked = !checked
    if (props.onCheck) {
      props.onCheck(newChecked)
    }
    setChecked(newChecked)
  }
  // If the parent wants us to change our checkedness
  React.useEffect(() => setChecked(props.checked), [props.checked, setChecked])

  return (
    <Kb.Icon
      type={checked ? 'iconfont-success' : 'iconfont-circle'}
      color={
        props.disabled
          ? Styles.globalColors.black_10
          : checked
          ? props.selectedColor ?? Styles.globalColors.blue
          : Styles.globalColors.black_20
      }
      onClick={props.disabled ? null : onClick}
      fontSize={props.fontSize}
      className={props.className}
    />
  )
}
export default CheckCircle
