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
  label: string,
  on: boolean,
  onClick: () => void,
  style?: ?Styles.StylesCrossPlatform,
|}

const Switch = React.forwardRef<Props, Kb.ClickableBox>((props: Props, ref) => (
  <Kb.ClickableBox
    onClick={props.onClick}
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
      style={Styles.collapseStyles([props.align !== 'right' && styles.switchLeft])}
    />
    {props.align === 'right' && <Kb.Box style={styles.gap} />}
    <Kb.Text type="BodySemibold">{props.label}</Kb.Text>
  </Kb.ClickableBox>
))

export default Switch

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
    },
    isElectron: {
      height: 24,
    },
    isMobile: {
      height: 32,
    },
  }),
  disabled: {
    opacity: 0.3,
  },
  gap: {
    flex: 1,
  },
  switchLeft: Styles.platformStyles({
    isElectron: {
      marginRight: 10,
    },
    isMobile: {
      marginRight: 12,
    },
  }),
})
