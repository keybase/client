import type {TextType} from '@/common-adapters/text.shared'
import type * as React from 'react'
import Switch from '@/common-adapters/switch'
import * as Styles from '@/styles'


type Props = {
  key?: string
  label?: string | React.ReactNode
  checkboxColor?: Styles.Color
  checkboxStyle?: Styles.StylesCrossPlatform
  labelComponent?: React.ReactNode
  labelSubtitle?: string
  labelType?: TextType
  onCheck?: (newCheckedValue: boolean) => void
  checked: boolean
  style?: Styles.StylesCrossPlatform
  disabled?: boolean
}
const Checkbox = (props: Props) => (
  <Switch
    align="left"
    color="blue"
    disabled={props.disabled}
    label={props.labelComponent || props.label || ''}
    labelType={props.labelType}
    on={props.checked}
    onClick={() => {
      props.onCheck?.(!props.checked)
    }}
    style={Styles.collapseStyles([styles.container, props.style])}
    labelSubtitle={props.labelSubtitle}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default Checkbox
