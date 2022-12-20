import Box, {Box2} from './box'
import Icon from './icon'
import Text from './text'
import type {Props} from './checkbox'
import * as Styles from '../styles'

const Kb = {
  Box,
  Box2,
  Icon,
  Text,
}

export const CHECKBOX_SIZE = 13
export const CHECKBOX_MARGIN = 8

const Checkbox = (props: Props) => {
  return (
    <Kb.Box
      style={Styles.collapseStyles([
        styles.container,
        !props.disabled && Styles.desktopStyles.clickable,
        props.style,
      ] as any)}
      onClick={e =>
        // If something in labelComponent needs to catch a click without calling this, use
        // event.preventDefault()
        props.disabled || e.defaultPrevented ? undefined : props.onCheck && props.onCheck(!props.checked)
      }
    >
      <Kb.Icon
        boxStyle={Styles.collapseStyles([
          styles.checkbox,
          !!props.boxBackgroundColor && styles.checkboxWhiteBorder,
          !props.checked &&
            !!props.boxBackgroundColor && {
              backgroundColor: props.boxBackgroundColor,
            },
          props.checked && !props.boxBackgroundColor && styles.checkboxChecked,
          props.disabled && styles.checkboxInactive,
          props.disabled && props.checked && styles.semiTransparent,
        ])}
        type="iconfont-check"
        style={Styles.collapseStyles([
          styles.icon,
          !!props.boxBackgroundColor && {color: props.boxBackgroundColor},
          !props.checked && styles.transparent,
        ])}
        hoverColor={Styles.globalColors.white}
        color={Styles.globalColors.white}
        fontSize={9}
      />
      <Kb.Box2 direction="vertical">
        <Kb.Text type="Body">{props.labelComponent || props.label}</Kb.Text>
        {!!props.labelSubtitle && <Kb.Text type="BodySmall">{props.labelSubtitle}</Kb.Text>}
      </Kb.Box2>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  checkbox: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.transition('background'),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
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
  checkboxChecked: {
    backgroundColor: Styles.globalColors.blue,
    borderColor: Styles.globalColors.blue,
  },
  checkboxInactive: {
    borderColor: Styles.globalColors.black_10,
  },
  checkboxWhiteBorder: {
    borderColor: Styles.globalColors.white,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    paddingBottom: 2,
    paddingTop: 2,
  },
  icon: {
    ...Styles.transition('opacity'),
    alignSelf: 'center',
  },
  opaque: {
    opacity: 1,
  },
  semiTransparent: {
    opacity: 0.4,
  },
  transparent: {
    opacity: 0,
  },
}))

export default Checkbox
