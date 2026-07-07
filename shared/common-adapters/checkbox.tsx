import {Box2, ClickableBox} from './box'
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

const Kb = {Box2, ClickableBox, Icon, Switch, Text}

const Checkbox = (props: Props) => {
  if (!isMobile) {
    return (
      <Kb.ClickableBox
        direction="horizontal"
        alignItems="flex-start"
        alignSelf="flex-start"
        gap="tiny"
        style={Styles.collapseStyles([
          styles.container,
          !props.disabled && styles.clickable,
          props.style,
        ])}
        onClick={e =>
          props.disabled || e?.defaultPrevented ? undefined : props.onCheck?.(!props.checked)
        }
      >
        <div
          style={Styles.castStyleDesktop(
            Styles.collapseStyles([
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
            style={Styles.collapseStyles([styles.icon, !props.checked && styles.transparent])}
            hoverColor={Styles.globalColors.white}
            color={props.checkboxColor ?? Styles.globalColors.white}
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
      </Kb.ClickableBox>
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

const styles = Styles.styleSheetCreate(() => ({
  checkbox: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.transition('background'),
      backgroundColor: Styles.globalColors.white,
      ...Styles.border(Styles.globalColors.black_20, 1, 2),
      flexShrink: 0,
      ...Styles.size(CHECKBOX_SIZE),
      justifyContent: 'center',
      marginTop: 2,
      position: 'relative',
    },
  }),
  checkboxChecked: {
    backgroundColor: Styles.globalColors.blue,
    borderColor: Styles.globalColors.blue,
  },
  checkboxInactive: {borderColor: Styles.globalColors.black_10},
  clickable: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  container: {
    ...Styles.paddingV(2),
  },
  icon: Styles.platformStyles({
    isElectron: {
      ...Styles.transition('opacity'),
      alignSelf: 'center',
    },
  }),
  mobileContainer: {
    ...Styles.paddingV(Styles.globalMargins.xtiny),
  },
  semiTransparent: {opacity: 0.4},
  transparent: {opacity: 0},
}))

export default Checkbox
