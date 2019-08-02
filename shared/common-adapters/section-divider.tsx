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
  label: string | React.ReactNode
  onToggleCollapsed?: () => void
  showSpinner?: boolean
}

const SectionDivider = (props: Props) => {
  const collapsible = Object.prototype.hasOwnProperty.call(props, 'collapsed')
  const children = (
    <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true} style={styles.container}>
      {typeof props.label === 'string' ? (
        <Kb.Text type="BodySmallSemibold">{props.label}</Kb.Text>
      ) : (
        props.label
      )}
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
const height = Styles.isMobile ? 40 : 32
SectionDivider.height = height

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.blueLighter3,
    height,
  },
  fullWidth: {
    width: '100%',
  },
  progress: {
    height: 20,
    width: 20,
  },
})

export default SectionDivider
