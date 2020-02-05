import * as React from 'react'
import * as Styles from '../styles'
import Icon from './icon'

const Kb = {Icon}

type Props = {
  onCheck: ((newCheckedValue: boolean) => void) | null
  checked: boolean
  disabled?: boolean
  fontSize?: number
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
  return (
    <Kb.Icon
      type={checked ? 'iconfont-success' : 'iconfont-circle'}
      color={props.disabled ? Styles.globalColors.black_20 : Styles.globalColors.blue}
      onClick={props.disabled ? null : onClick}
      fontSize={props.fontSize}
    />
  )
}
export default CheckCircle
