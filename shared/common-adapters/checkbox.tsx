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
  const {
    checkboxColor,
    checkboxStyle,
    checked,
    disabled,
    label,
    labelComponent,
    labelSubtitle,
    labelType,
    onCheck,
    style,
  } = props

  if (!isMobile) {
    return (
      <Kb.ClickableBox
        direction="horizontal"
        alignItems="flex-start"
        alignSelf="flex-start"
        gap="tiny"
        style={Styles.collapseStyles([
          styles.container,
          !disabled && styles.clickable,
          style,
        ])}
        onClick={e =>
          disabled || e?.defaultPrevented ? undefined : onCheck?.(!checked)
        }
      >
        <div
          style={Styles.castStyleDesktop(
            Styles.collapseStyles([
              styles.checkbox,
              checked && styles.checkboxChecked,
              disabled && styles.checkboxInactive,
              disabled && checked && styles.semiTransparent,
              checkboxStyle,
            ])
          )}
        >
          <Kb.Icon
            type="iconfont-check"
            style={Styles.collapseStyles([styles.icon, !checked && styles.transparent])}
            hoverColor={Styles.globalColors.white}
            color={checkboxColor ?? Styles.globalColors.white}
            fontSize={9}
          />
        </div>
        <Kb.Box2 direction="vertical">
          {labelComponent ||
            (typeof label === 'string' ? <Kb.Text type={labelType ?? 'Body'}>{label}</Kb.Text> : label)}
          {!!labelSubtitle && <Kb.Text type="BodySmall">{labelSubtitle}</Kb.Text>}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }

  return (
    <Kb.Switch
      align="left"
      color="blue"
      disabled={disabled}
      label={labelComponent || label || ''}
      labelType={labelType}
      on={checked}
      onClick={() => {
        onCheck?.(!checked)
      }}
      style={Styles.collapseStyles([styles.mobileContainer, style])}
      labelSubtitle={labelSubtitle}
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
