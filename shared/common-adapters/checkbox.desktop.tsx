import Box, {Box2} from './box'
import Icon from './icon'
import Text from './text'
import type {Props} from './checkbox'
import * as Styles from '@/styles'

const Kb = {
  Box,
  Box2,
  Icon,
  Styles,
  Text,
}

const CHECKBOX_SIZE = 13
const CHECKBOX_MARGIN = 8

const Checkbox = (props: Props) => {
  return (
    <Kb.Box
      style={Kb.Styles.collapseStyles([styles.container, !props.disabled && styles.clickable, props.style])}
      onClick={e =>
        // If something in labelComponent needs to catch a click without calling this, use
        // event.preventDefault()
        props.disabled || e.defaultPrevented ? undefined : props.onCheck?.(!props.checked)
      }
    >
      <Kb.Icon
        boxStyle={Kb.Styles.collapseStyles([
          styles.checkbox,
          props.checked && styles.checkboxChecked,
          props.disabled && styles.checkboxInactive,
          props.disabled && props.checked && styles.semiTransparent,
          props.checkboxStyle,
        ])}
        type="iconfont-check"
        style={Kb.Styles.collapseStyles([styles.icon, !props.checked && styles.transparent])}
        hoverColor={Kb.Styles.globalColors.white}
        color={props.checkboxColor ?? Kb.Styles.globalColors.white}
        fontSize={9}
      />
      <Kb.Box2 direction="vertical">
        {props.labelComponent || (typeof props.label === 'string' ? (
          <Kb.Text type={props.labelType ?? 'Body'}>{props.label}</Kb.Text>
        ) : (
          props.label
        ))}
        {!!props.labelSubtitle && <Kb.Text type="BodySmall">{props.labelSubtitle}</Kb.Text>}
      </Kb.Box2>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      ...Kb.Styles.transition('background'),
      backgroundColor: Kb.Styles.globalColors.white,
      borderColor: Kb.Styles.globalColors.black_20,
      borderRadius: 2,
      borderStyle: 'solid',
      borderWidth: 1,
      flexShrink: 0,
      height: CHECKBOX_SIZE,
      justifyContent: 'center',
      marginRight: CHECKBOX_MARGIN,
      marginTop: 2,
      position: 'relative',
      width: CHECKBOX_SIZE,
    },
  }),
  checkboxChecked: {
    backgroundColor: Kb.Styles.globalColors.blue,
    borderColor: Kb.Styles.globalColors.blue,
  },
  checkboxInactive: {borderColor: Kb.Styles.globalColors.black_10},
  clickable: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
    },
  }),
  container: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    paddingBottom: 2,
    paddingTop: 2,
  },
  icon: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.transition('opacity'),
      alignSelf: 'center',
    },
  }),
  opaque: {opacity: 1},
  semiTransparent: {opacity: 0.4},
  transparent: {opacity: 0},
}))

export default Checkbox
