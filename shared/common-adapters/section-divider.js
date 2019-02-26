// @flow
import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'
import Text from './text'
import Icon from './icon'
import ClickableBox from './clickable-box'

type Props = {|
  collapsed?: boolean, // if set, render the appropriate caret
  label: string,
  onToggleCollapsed?: () => void,
|}

const SectionDivider = (props: Props) => {
  const collapsible = props.hasOwnProperty('collapsed')
  const children = (
    <Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true} style={styles.container}>
      <Text type="BodySmallSemibold">{props.label}</Text>
      {collapsible && (
        <Icon sizeType="Tiny" type={props.collapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'} />
      )}
    </Box2>
  )
  return collapsible ? (
    <ClickableBox onClick={props.onToggleCollapsed} style={styles.fullWidth}>
      {children}
    </ClickableBox>
  ) : (
    children
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.blue5,
    },
    isElectron: {
      height: 24,
    },
    isMobile: {
      height: 32,
    },
  }),
  fullWidth: {
    width: '100%',
  },
})

export default SectionDivider
