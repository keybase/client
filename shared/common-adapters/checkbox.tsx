import {Box2, ClickableBox3} from './box'
import Icon from './icon'
import Switch from '@/common-adapters/switch'
import Text from './text'
import * as Styles from '@/styles'
import type * as React from 'react'
import type {TextType} from './text.shared'

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

const CHECKBOX_SIZE = 13
const CHECKBOX_MARGIN = 8

const Kb = {Box2, ClickableBox3, Icon, Styles, Switch, Text}

const Checkbox = (props: Props) => {
  if (!isMobile) {
    return (
      <Kb.ClickableBox3
        direction="horizontal"
        alignItems="flex-start"
        alignSelf="flex-start"
        style={Kb.Styles.collapseStyles([
          styles.container,
          !props.disabled && styles.clickable,
          props.style,
        ])}
        onClick={e =>
          props.disabled || e?.defaultPrevented ? undefined : props.onCheck?.(!props.checked)
        }
      >
        <div
          style={Kb.Styles.castStyleDesktop(
            Kb.Styles.collapseStyles([
              styles.checkbox,
              props.checked && styles.checkboxChecked,
              props.disabled && styles.checkboxInactive,
              props.disabled && props.checked && styles.semiTransparent,
              props.checkboxStyle,
            ])
          )}
        >
          <Kb.Icon
            type="iconfont-check"
            style={Kb.Styles.collapseStyles([styles.icon, !props.checked && styles.transparent])}
            hoverColor={Kb.Styles.globalColors.white}
            color={props.checkboxColor ?? Kb.Styles.globalColors.white}
            fontSize={9}
          />
        </div>
        <Kb.Box2 direction="vertical">
          {props.labelComponent ||
            (typeof props.label === 'string' ? (
              <Kb.Text type={props.labelType ?? 'Body'}>{props.label}</Kb.Text>
            ) : (
              props.label
            ))}
          {!!props.labelSubtitle && <Kb.Text type="BodySmall">{props.labelSubtitle}</Kb.Text>}
        </Kb.Box2>
      </Kb.ClickableBox3>
    )
  }

  return (
    <Kb.Switch
      align="left"
      color="blue"
      disabled={props.disabled}
      label={props.labelComponent || props.label || ''}
      labelType={props.labelType}
      on={props.checked}
      onClick={() => {
        props.onCheck?.(!props.checked)
      }}
      style={Styles.collapseStyles([styles.mobileContainer, props.style])}
      labelSubtitle={props.labelSubtitle}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkbox: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      ...Kb.Styles.transition('background'),
      backgroundColor: Kb.Styles.globalColors.white,
      ...Kb.Styles.border(Kb.Styles.globalColors.black_20, 1, 2),
      flexShrink: 0,
      ...Kb.Styles.size(CHECKBOX_SIZE),
      justifyContent: 'center',
      marginRight: CHECKBOX_MARGIN,
      marginTop: 2,
      position: 'relative',
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
    ...Kb.Styles.paddingV(2),
  },
  icon: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.transition('opacity'),
      alignSelf: 'center',
    },
  }),
  mobileContainer: {
    ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xtiny),
  },
  semiTransparent: {opacity: 0.4},
  transparent: {opacity: 0},
}))

export default Checkbox
