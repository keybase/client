import * as React from 'react'
import * as Styles from '../styles'
import {Box2} from './box'
import Text from './text'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'

const Kb = {
  Box2,
  ClickableBox,
  Icon,
  ProgressIndicator,
  Text,
}

type Props = {
  collapsed?: boolean // if set, render the appropriate caret,
  label: string
  onToggleCollapsed?: () => void
  showSpinner?: boolean
}

const SectionDivider = (props: Props) => {
  const collapsible = props.hasOwnProperty('collapsed')
  const children = (
    <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true} style={styles.container}>
      <Kb.Text type="BodySmallSemibold">{props.label}</Kb.Text>
      {collapsible && (
        <Kb.Icon sizeType="Tiny" type={props.collapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'} />
      )}
      {props.showSpinner && <Kb.ProgressIndicator style={styles.progress} />}
    </Kb.Box2>
  )
  return collapsible ? (
    <Kb.ClickableBox onClick={props.onToggleCollapsed} style={styles.fullWidth}>
      {children}
    </Kb.ClickableBox>
  ) : (
    children
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.blueLighter3,
    },
    isElectron: {
      height: 32,
    },
    isMobile: {
      height: 40,
    },
  }),
  fullWidth: {
    width: '100%',
  },
  progress: {
    height: 20,
    width: 20,
  },
})

export default SectionDivider
