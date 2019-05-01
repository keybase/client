// @flow
import * as React from 'react'
import * as Styles from '../styles'
import ClickableBox from './clickable-box'
import Box, {Box2} from './box'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import SwitchToggle from './switch-toggle'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  ProgressIndicator,
  Text,
}

type Props = {|
  align?: ?('left' | 'right'), // default to 'left'
  color?: ?('blue' | 'green'), // default to 'blue'
  disabled?: ?boolean,
  gapInBetween?: ?boolean, // inserts flex:1 gap between toggle and text
  label: string | React.Node,
  labelSubtitle?: ?string, // only effective when label is a string
  on: boolean,
  onClick: () => void,
  style?: ?Styles.StylesCrossPlatform,
|}

const Switch = React.forwardRef<Props, Kb.ClickableBox>((props: Props, ref) => (
  <Kb.ClickableBox
    onClick={props.disabled ? undefined : props.onClick}
    style={Styles.collapseStyles([
      props.align !== 'right' ? Styles.globalStyles.flexBoxRow : Styles.globalStyles.flexBoxRowReverse,
      styles.container,
      props.disabled && styles.disabled,
      props.style,
    ])}
    ref={ref}
  >
    <SwitchToggle
      on={props.on}
      color={props.color || 'blue'}
      style={Styles.collapseStyles([
        props.align === 'left' && styles.switchLeft,
        props.align === 'right' && styles.switchRight,
      ])}
    />
    {!!props.gapInBetween && <Kb.Box style={styles.gap} />}
    {typeof props.label === 'string' ? (
      <Kb.Box2 direction="vertical" style={styles.labelContainer}>
        <Kb.Text type="BodySemibold">{props.label}</Kb.Text>
        {!!props.labelSubtitle && <Kb.Text type="BodyTiny">{props.labelSubtitle}</Kb.Text>}
      </Kb.Box2>
    ) : (
      props.label
    )}
  </Kb.ClickableBox>
))

export default Switch

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
    },
    isElectron: {
      minHeight: 24,
    },
    isMobile: {
      minHeight: 32,
    },
  }),
  disabled: {
    opacity: 0.3,
  },
  gap: {
    flex: 1,
  },
  labelContainer: {
    flexShrink: 1,
  },
  switchLeft: Styles.platformStyles({
    isElectron: {
      marginRight: 10,
    },
    isMobile: {
      marginRight: 12,
    },
  }),
  switchRight: Styles.platformStyles({
    isElectron: {
      marginLeft: 10,
    },
    isMobile: {
      marginLeft: 12,
    },
  }),
})
