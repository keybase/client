import Switch from './switch'
import type {Props} from './checkbox'
import * as Styles from '@/styles'

const Checkbox = (props: Props) => (
  <Switch
    align="left"
    color="blue"
    label={props.labelComponent || props.label || ''}
    on={props.checked}
    onClick={() => {
      props.onCheck?.(!props.checked)
    }}
    style={Styles.collapseStyles([styles.container, props.style])}
    {...(props.disabled === undefined ? {} : {disabled: props.disabled})}
    {...(props.labelType === undefined ? {} : {labelType: props.labelType})}
    {...(props.labelSubtitle === undefined ? {} : {labelSubtitle: props.labelSubtitle})}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default Checkbox
